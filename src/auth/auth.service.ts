import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    // Use the raw (un-computed) status here — findOne()/applyDynamicStatus reports a
    // student as "Inactive" once validity_end has passed, which must NOT block login.
    // Premium/validity expiry only restricts premium features/content, never login;
    // only a real admin-set Inactive status does that.
    const user = await this.usersService.findOneRaw(username);
    if (user && (await bcrypt.compare(pass, user.password_hash))) {

      // Check for allowed time slots (numeric comparison to avoid string edge-cases)
      if (user.role === 'Student' && user.allowed_login_time_start && user.allowed_login_time_end) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = user.allowed_login_time_start.split(':').map(Number);
        const [endH, endM] = user.allowed_login_time_end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
            throw new UnauthorizedException(`Login blocked. Please login between ${user.allowed_login_time_start} and ${user.allowed_login_time_end}`);
        }
      }

      // Check if student is active (admin-disabled accounts only — NOT expired validity)
      if (user.role === 'Student' && user.status === 'Inactive') {
        throw new UnauthorizedException('Your account is inactive. Please contact the administrator.');
      }

      const { password_hash, ...result } = user;
      return { ...result, premium_expired: this.isPremiumExpired(user) };
    }
    return null;
  }

  /** True once a Student's validity_end has passed — feature/content gate only, never a login gate. */
  private isPremiumExpired(user: User): boolean {
    if (user.role !== 'Student' || !user.validity_end) return false;
    const endDate = new Date(user.validity_end);
    endDate.setHours(23, 59, 59, 999);
    return new Date() > endDate;
  }

  async login(user: any) {
    const payload = {
      username: user.user_id,
      sub: user.id,
      role: user.role,
      permissions: user.permissions || [],
      validity_end: user.validity_end,
      premium_expired: user.premium_expired ?? this.isPremiumExpired(user),
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async signup(userData: any) {
    const existing = await this.usersService.findOne(userData.username);
    if (existing) {
      throw new ConflictException('Username already exists');
    }

    const { password, username, ...rest } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await this.usersService.create({
      ...rest,
      user_id: username,
      password_hash: hashedPassword,
      status: 'Active',
    });

    const { password_hash, ...result } = user;
    return result;
  }
}
