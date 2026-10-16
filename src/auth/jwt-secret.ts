import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import { join } from 'path';

// The key that signs login tokens. It used to fall back to a hard-coded string,
// so anyone who knew it could forge an Admin token. Order of preference:
//   1. JWT_SECRET from the environment (read lazily — ConfigModule loads .env
//      only after the module files are imported, so reading it at import time
//      would miss a value set in .env);
//   2. a random key generated once and kept in private/jwt-secret, so restarts
//      don't log everybody out.
const SECRET_FILE = join(process.cwd(), 'private', 'jwt-secret');
const KNOWN_DEFAULTS = new Set(['SUPER_SECRET_KEY']);
let cached: string | null = null;

export function getJwtSecret(): string {
  if (cached) return cached;
  const fromEnv = (process.env.JWT_SECRET || '').trim();
  if (fromEnv && !KNOWN_DEFAULTS.has(fromEnv)) {
    cached = fromEnv;
    return cached;
  }
  const logger = new Logger('JwtSecret');
  try {
    const saved = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (saved.length >= 32) {
      cached = saved;
      return cached;
    }
  } catch {
    // not created yet
  }
  cached = randomBytes(48).toString('hex');
  try {
    fs.mkdirSync(join(process.cwd(), 'private'), { recursive: true });
    fs.writeFileSync(SECRET_FILE, cached, { mode: 0o600 });
    logger.warn(`JWT_SECRET is not set — generated a random signing key in ${SECRET_FILE}. Set JWT_SECRET in the environment to manage it yourself.`);
  } catch (err: any) {
    logger.warn(`JWT_SECRET is not set and ${SECRET_FILE} could not be written (${err?.message}); using a per-process key, so logins reset on every restart.`);
  }
  return cached;
}
