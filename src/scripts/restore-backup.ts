// Restore a backup from the server command line.
//
//   npm run backup:restore                                   list backups
//   npm run backup:restore -- <file.zip> --confirm <DB_NAME> [--skip-files] [--no-safety-backup]
//
// Stop the running backend first so nobody writes data during the restore.
// A safety backup of the current data is taken before anything is replaced.
import 'reflect-metadata';
process.env.BACKUP_SCHEDULER_DISABLED = 'true';

import { NestFactory } from '@nestjs/core';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { AppModule } from '../app.module';
import { BackupService, BACKUP_DIR } from '../backup/backup.service';

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--confirm');
  const confirm = args.includes('--confirm') ? args[args.indexOf('--confirm') + 1] : null;
  const dbName = process.env.DB_DATABASE || '';

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const backups = app.get(BackupService);
  backups.stopScheduler();
  try {
    if (!fileArg) {
      const list = backups.list();
      console.log(`Backups in ${BACKUP_DIR}:`);
      for (const b of list) console.log(`  ${b.name}  ${(b.size_bytes / 1048576).toFixed(1)} MB  ${b.created_at}`);
      if (!list.length) console.log('  (none)');
      console.log(`\nTo restore: npm run backup:restore -- <file.zip> --confirm ${dbName || '<DB_NAME>'}`);
      return;
    }
    const path = [resolve(fileArg), join(BACKUP_DIR, fileArg)].find((p) => existsSync(p));
    if (!path) throw new Error(`Backup file not found: ${fileArg}`);
    const manifest = await backups.readManifest(path);
    const rows = Object.values(manifest.database?.tables || {}).reduce((a: number, b: any) => a + Number(b), 0);
    console.log(`Backup: ${path}\nMade: ${manifest.created_at} (${manifest.kind})\nTables: ${Object.keys(manifest.database.tables).length}, rows: ${rows}, files: ${manifest.files?.count ?? 0}`);
    console.log(`Target database: ${dbName} on ${process.env.DB_HOST || 'localhost'}`);
    if (!dbName || confirm !== dbName) {
      console.error(`\nNothing changed. This replaces ALL data in "${dbName}". To go ahead, add:  --confirm ${dbName}`);
      process.exitCode = 1;
      return;
    }
    if (!args.includes('--no-safety-backup')) {
      console.log('\nTaking a safety backup of the current data first…');
      const safety = await backups.create('pre-restore', 'restore-command');
      console.log(`Safety backup: ${safety.name}`);
    }
    console.log('\nRestoring…');
    const r = await backups.restore(path, { skipFiles: args.includes('--skip-files'), log: (s) => console.log(s) });
    console.log(`\nDone: ${r.tables} tables${r.skipped.length ? ` (skipped: ${r.skipped.join(', ')})` : ''}, ${r.files} files. Start the backend again and ask everyone to sign in again.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(`\nRestore failed: ${err?.message || err}\nThe database was not changed (the restore runs in one transaction).`);
  process.exit(1);
});
