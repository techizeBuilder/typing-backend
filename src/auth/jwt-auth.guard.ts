import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// For media an <audio> element loads by URL (it cannot send headers): the login
// token may also come as ?access_token=. Same checks as JwtAuthGuard otherwise.
@Injectable()
export class MediaAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = typeof req.query?.access_token === 'string' ? req.query.access_token : '';
    if (!req.headers.authorization && token) req.headers.authorization = `Bearer ${token}`;
    return req;
  }
}
