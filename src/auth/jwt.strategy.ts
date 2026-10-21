import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { getJwtSecret } from './jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // Students must be Active; staff are blocked once deactivated.
    if (user.role === 'Student' ? user.status !== 'Active' : user.status === 'Inactive') {
      throw new UnauthorizedException('Your account is inactive. Please contact the administrator.');
    }
    // Single-device students: a session from any device other than the
    // registered one ends (e.g. after an admin reset and a login elsewhere).
    if (user.role === 'Student' && user.login_type === 'Single' && user.device_id && payload.did !== user.device_id) {
      throw new UnauthorizedException('This account is now registered on another device. Please contact the institute.');
    }
    // Role and permissions come from the database, not the token, so a role
    // change or a deactivation takes effect on the next request.
    return { userId: user.id, username: user.user_id, role: user.role, permissions: user.permissions || [] };
  }
}
