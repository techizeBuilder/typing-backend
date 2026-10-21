import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { map } from 'rxjs/operators';

// Removes password hashes (and device lock keys) from every API response, however deeply nested (e.g.
// a result's joined user). Endpoints should not select them in the first place;
// this is the safety net.
// device_id is the Single-device lock key: admins only need device_info / device_bound_at.
const SECRET_KEYS = ['password_hash', 'device_id'];

function strip(value: any, seen: WeakSet<object>): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  if (value instanceof Date || Buffer.isBuffer(value) || value instanceof StreamableFile) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const v of value) strip(v, seen);
    return;
  }
  for (const key of Object.keys(value)) {
    if (SECRET_KEYS.includes(key)) delete value[key];
    else strip(value[key], seen);
  }
}

@Injectable()
export class StripSecretsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data) => {
      strip(data, new WeakSet());
      return data;
    }));
  }
}
