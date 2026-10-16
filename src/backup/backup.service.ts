import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import archiver from 'archiver';
import * as yauzl from 'yauzl';
import * as fs from 'fs';
import * as readline from 'readline';
import { join, resolve, sep, relative } from 'path';
import { Readable } from 'stream';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../entities/app_setting.entity';

// Backups: one .zip per backup with every public table as JSON lines plus the
// uploaded files. Stored privately under ./private/backups (not served, not in
// git). Restoring is done from the server command line (scripts/restore-backup).

export const BACKUP_DIR = join(process.cwd(), 'private', 'backups');
const FORMAT = 'typing-app-backup';
const NAME = /^backup-\d{8}-\d{6}-(manual|scheduled|pre-restore)\.zip$/;
const LOCK_KEY = 727301; // pg advisory lock id shared by every backend instance
const BATCH = 2000;

// Folders copied into the backup: public uploads and private files (magazines),
// excluding the backups themselves.
const FILE_ROOTS = [
  { prefix: 'uploads', dir: () => join(process.cwd(), 'uploads'), ignore: [] as string[] },
  { prefix: 'private', dir: () => join(process.cwd(), 'private'), ignore: ['backups/**'] },
];

export interface BackupInfo {
  name: string;
  kind: string;
  created_at: string;
  size_bytes: number;
  tables: Record<string, number>;
  files: number;
  created_by?: string | null;
  duration_ms?: number;
}

const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

function countFiles(dir: string, skip?: string): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip && e.name === skip) continue;
    n += e.isDirectory() ? countFiles(join(dir, e.name)) : 1;
  }
  return n;
}

@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  private running: { kind: string; started_at: string } | null = null;
  private lastError: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly dataSource: DataSource, private readonly settings: SettingsService) {}

  onModuleInit() {
    if (process.env.BACKUP_SCHEDULER_DISABLED === 'true') return;
    this.timer = setInterval(() => { this.tick().catch((e) => this.logger.warn(`Scheduled backup check failed: ${e?.message}`)); }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  stopScheduler() { this.onModuleDestroy(); this.timer = null; }

  // ── Schedule ──────────────────────────────────────────────────────────────
  async getSchedule() {
    const all = await this.settings.getAll();
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(all[SETTING_KEYS.BACKUP_TIME] || '') ? all[SETTING_KEYS.BACKUP_TIME] : '02:00';
    return {
      enabled: all[SETTING_KEYS.BACKUP_SCHEDULE_ENABLED] !== 'false',
      time,
      keep: Math.max(1, parseInt(all[SETTING_KEYS.BACKUP_KEEP], 10) || 7),
    };
  }

  private nextRun(time: string) {
    const [h, m] = time.split(':').map(Number);
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  // Runs every minute: once the scheduled time has passed today and there is no
  // scheduled backup for today yet, make one.
  private async tick() {
    const s = await this.getSchedule();
    if (!s.enabled || this.running) return;
    const now = new Date();
    const [h, m] = s.time.split(':').map(Number);
    if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
    const today = stamp(now).slice(0, 8);
    if (this.list().some((b) => b.kind === 'scheduled' && b.name.slice(7, 15) === today)) return;
    await this.create('scheduled', null).catch((e) => this.logger.error(`Scheduled backup failed: ${e?.message}`));
  }

  // ── Listing ───────────────────────────────────────────────────────────────
  list(): BackupInfo[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR)
      .filter((f) => NAME.test(f))
      .map((f) => {
        const meta = join(BACKUP_DIR, `${f}.json`);
        let info: any = {};
        try { info = JSON.parse(fs.readFileSync(meta, 'utf8')); } catch { /* sidecar missing: still list the zip */ }
        return {
          name: f,
          kind: f.match(NAME)![1],
          created_at: info.created_at || fs.statSync(join(BACKUP_DIR, f)).mtime.toISOString(),
          size_bytes: fs.statSync(join(BACKUP_DIR, f)).size,
          tables: info.database?.tables || {},
          files: info.files?.count ?? 0,
          created_by: info.created_by ?? null,
          duration_ms: info.duration_ms,
        } as BackupInfo;
      })
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  async status() {
    const schedule = await this.getSchedule();
    return {
      running: this.running,
      last_error: this.lastError,
      schedule: { ...schedule, next_run: schedule.enabled ? this.nextRun(schedule.time) : null },
      backups: this.list(),
      folder: BACKUP_DIR,
    };
  }

  pathFor(name: string) {
    if (!NAME.test(name || '')) throw new BadRequestException('Invalid backup name.');
    const p = join(BACKUP_DIR, name);
    if (!fs.existsSync(p)) throw new NotFoundException('Backup not found.');
    return p;
  }

  remove(name: string) {
    const p = this.pathFor(name);
    fs.unlinkSync(p);
    if (fs.existsSync(`${p}.json`)) fs.unlinkSync(`${p}.json`);
    return { deleted: true };
  }

  // Start a backup without waiting for it (the admin page polls status).
  startManual(createdBy: string) {
    if (this.running) throw new ConflictException('A backup is already running.');
    this.create('manual', createdBy).catch((e) => this.logger.error(`Manual backup failed: ${e?.message}`));
    return { started: true };
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async create(kind: 'manual' | 'scheduled' | 'pre-restore', createdBy: string | null): Promise<BackupInfo> {
    if (this.running) throw new ConflictException('A backup is already running.');
    this.running = { kind, started_at: new Date().toISOString() };
    this.lastError = null;
    const started = Date.now();
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    const name = `backup-${stamp()}-${kind}.zip`;
    const file = join(BACKUP_DIR, name);
    const part = `${file}.part`;
    let locked = false;
    try {
      const [{ ok }] = await runner.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
      if (!ok) throw new ConflictException('Another server is making a backup right now.');
      locked = true;
      fs.mkdirSync(BACKUP_DIR, { recursive: true });

      // One consistent snapshot for every table. Lock the tables (ACCESS SHARE only
      // blocks schema changes, not normal writes) before the snapshot's first read,
      // like pg_dump: a table rewrite running at the same time (e.g. the ALTER COLUMN
      // TYPE at startup) would otherwise make that table look empty in the snapshot.
      const tables: string[] = (await runner.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
      )).map((r: any) => r.table_name);
      await runner.startTransaction('REPEATABLE READ');
      if (tables.length) await runner.query(`LOCK TABLE ${tables.map(q).join(', ')} IN ACCESS SHARE MODE`);
      const counts: Record<string, number> = {};
      for (const t of tables) counts[t] = Number((await runner.query(`SELECT COUNT(*)::int AS n FROM ${q(t)}`))[0].n);
      const fileCount = FILE_ROOTS.reduce((n, r) => n + countFiles(r.dir(), r.prefix === 'private' ? 'backups' : undefined), 0);
      const manifest = {
        format: FORMAT, version: 1, created_at: new Date().toISOString(), kind, created_by: createdBy,
        database: { tables: counts }, files: { count: fileCount, roots: FILE_ROOTS.map((r) => r.prefix) },
      };

      const out = fs.createWriteStream(part);
      const zip = archiver('zip', { zlib: { level: 6 } });
      const done = new Promise<void>((res, rej) => { out.on('close', () => res()); zip.on('error', rej); out.on('error', rej); });
      zip.pipe(out);
      // Append one entry at a time: archiver starts reading a stream as soon as it is
      // appended, and the tables share one connection, so their queries must not overlap.
      const add = (source: string | Readable, entry: string) => {
        const added = new Promise((res) => zip.once('entry', res));
        zip.append(source, { name: entry });
        return Promise.race([added, done]);
      };
      await add(JSON.stringify(manifest, null, 2), 'manifest.json');
      for (const t of tables) await add(Readable.from(this.tableLines(runner, t)), `db/${t}.jsonl`);
      for (const r of FILE_ROOTS) {
        if (fs.existsSync(r.dir())) zip.glob('**/*', { cwd: r.dir(), ignore: r.ignore, dot: true, nodir: true } as any, { prefix: `files/${r.prefix}` });
      }
      await zip.finalize();
      await done;
      await runner.commitTransaction();

      fs.renameSync(part, file);
      const info = { ...manifest, duration_ms: Date.now() - started };
      fs.writeFileSync(`${file}.json`, JSON.stringify(info, null, 2));
      this.logger.log(`Backup ${name} created (${fs.statSync(file).size} bytes, ${Date.now() - started} ms).`);
      if (kind === 'scheduled') this.applyRetention((await this.getSchedule()).keep);
      return this.list().find((b) => b.name === name)!;
    } catch (err) {
      this.lastError = (err as Error)?.message || 'Backup failed.';
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => {});
      fs.promises.unlink(part).catch(() => {});
      throw err;
    } finally {
      if (locked) await runner.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
      await runner.release();
      this.running = null;
    }
  }

  private async *tableLines(runner: QueryRunner, table: string) {
    for (let offset = 0; ; offset += BATCH) {
      const rows = await runner.query(`SELECT row_to_json(t)::text AS j FROM ${q(table)} t ORDER BY ctid LIMIT ${BATCH} OFFSET ${offset}`);
      if (!rows.length) return;
      yield rows.map((r: any) => r.j).join('\n') + '\n';
      if (rows.length < BATCH) return;
    }
  }

  // Keep only the newest `keep` scheduled backups (manual ones stay until deleted).
  private applyRetention(keep: number) {
    for (const b of this.list().filter((x) => x.kind === 'scheduled').slice(keep)) {
      try { this.remove(b.name); this.logger.log(`Removed old scheduled backup ${b.name}.`); } catch { /* ignore */ }
    }
  }

  // ── Restore (server command line only) ────────────────────────────────────
  private openZip(path: string): Promise<yauzl.ZipFile> {
    return new Promise((res, rej) => yauzl.open(path, { lazyEntries: true, autoClose: false }, (e, z) => (e ? rej(e) : res(z))));
  }

  private async entries(zip: yauzl.ZipFile) {
    const map = new Map<string, yauzl.Entry>();
    await new Promise<void>((res, rej) => {
      zip.on('entry', (e: yauzl.Entry) => { map.set(e.fileName, e); zip.readEntry(); });
      zip.on('end', () => res());
      zip.on('error', rej);
      zip.readEntry();
    });
    return map;
  }

  private stream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
    return new Promise((res, rej) => zip.openReadStream(entry, (e, s) => (e ? rej(e) : res(s))));
  }

  async readManifest(path: string) {
    const zip = await this.openZip(path);
    try {
      const map = await this.entries(zip);
      const m = map.get('manifest.json');
      if (!m) throw new BadRequestException('Not a backup made by this app (no manifest.json).');
      let text = '';
      for await (const chunk of await this.stream(zip, m)) text += chunk;
      const manifest = JSON.parse(text);
      if (manifest.format !== FORMAT) throw new BadRequestException('Not a backup made by this app.');
      return manifest;
    } finally { zip.close(); }
  }

  // Order tables so referenced tables are filled before the tables that point to them.
  private async insertOrder(runner: QueryRunner, tables: string[]) {
    const fks = await runner.query(`
      SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
      FROM pg_constraint c WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`);
    const strip = (s: string) => s.replace(/^public\./, '').replace(/^"|"$/g, '');
    const deps = new Map(tables.map((t) => [t, new Set<string>()]));
    for (const f of fks) {
      const child = strip(f.child); const parent = strip(f.parent);
      if (child !== parent && deps.has(child) && deps.has(parent)) deps.get(child)!.add(parent);
    }
    const order: string[] = [];
    const seen = new Set<string>();
    const visit = (t: string, stack: Set<string>) => {
      if (seen.has(t) || stack.has(t)) return;
      stack.add(t);
      for (const p of deps.get(t)!) visit(p, stack);
      stack.delete(t);
      seen.add(t);
      order.push(t);
    };
    for (const t of tables) visit(t, new Set());
    return order;
  }

  // Replaces the data of every table in the backup (one transaction), then
  // writes the backed-up files. Tables added after the backup was made are left
  // as they are unless they reference restored tables.
  async restore(path: string, opts: { skipFiles?: boolean; log?: (s: string) => void } = {}) {
    const log = opts.log || ((s: string) => this.logger.log(s));
    const manifest = await this.readManifest(path);
    const zip = await this.openZip(path);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const map = await this.entries(zip);
      const existing: string[] = (await runner.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      )).map((r: any) => r.table_name);
      const inBackup = Object.keys(manifest.database?.tables || {});
      const tables = inBackup.filter((t) => existing.includes(t) && map.has(`db/${t}.jsonl`));
      const skipped = inBackup.filter((t) => !tables.includes(t));
      if (skipped.length) log(`Skipping tables not in this database: ${skipped.join(', ')}`);
      const order = await this.insertOrder(runner, tables);

      await runner.startTransaction();
      await runner.query(`TRUNCATE ${tables.map(q).join(', ')} RESTART IDENTITY CASCADE`);
      for (const t of order) {
        const rl = readline.createInterface({ input: await this.stream(zip, map.get(`db/${t}.jsonl`)!), crlfDelay: Infinity });
        let batch: string[] = [];
        let n = 0;
        const flush = async () => {
          if (!batch.length) return;
          await runner.query(`INSERT INTO ${q(t)} SELECT * FROM json_populate_recordset(NULL::${q(t)}, $1::json)`, [`[${batch.join(',')}]`]);
          n += batch.length;
          batch = [];
        };
        for await (const line of rl) {
          if (!line.trim()) continue;
          batch.push(line);
          if (batch.length >= 500) await flush();
        }
        await flush();
        // Move serial sequences past the restored ids.
        const serials = await runner.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_default LIKE 'nextval(%'`, [t]);
        for (const s of serials) {
          await runner.query(`SELECT setval(pg_get_serial_sequence($1, $2), COALESCE(MAX(${q(s.column_name)}), 1), MAX(${q(s.column_name)}) IS NOT NULL) FROM ${q(t)}`, [q(t), s.column_name]);
        }
        log(`  ${t}: ${n} rows`);
      }
      await runner.commitTransaction();
      log('Database restored.');

      let files = 0;
      if (!opts.skipFiles) {
        for (const [fileName, entry] of map) {
          const m = fileName.match(/^files\/(uploads|private)\/(.+)$/);
          if (!m || fileName.endsWith('/')) continue;
          const root = FILE_ROOTS.find((r) => r.prefix === m[1])!.dir();
          const target = resolve(root, m[2]);
          if (!target.startsWith(resolve(root) + sep) || relative(root, target).startsWith(`backups${sep}`)) continue; // no path tricks
          fs.mkdirSync(resolve(target, '..'), { recursive: true });
          await new Promise<void>(async (res, rej) => {
            const s = await this.stream(zip, entry);
            s.pipe(fs.createWriteStream(target)).on('finish', () => res()).on('error', rej);
          });
          files++;
        }
        log(`Files restored: ${files}.`);
      }
      return { tables: order.length, skipped, files };
    } catch (err) {
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => {});
      throw err;
    } finally {
      zip.close();
      await runner.release();
    }
  }
}
