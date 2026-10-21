import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { DEFAULT_TIME_ZONE, inWindow, zonedNow } from '../common/zoned-time';

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

      // Fixed login window, checked on the student's time zone (India time by
      // default, not the server clock). Windows may cross midnight.
      if (user.role === 'Student' && user.allowed_login_time_start && user.allowed_login_time_end) {
        const { minutes } = zonedNow(new Date(), user.login_timezone || DEFAULT_TIME_ZONE);
        if (!inWindow(minutes, user.allowed_login_time_start, user.allowed_login_time_end)) {
            throw new UnauthorizedException(`Login blocked. Please login between ${user.allowed_login_time_start} and ${user.allowed_login_time_end}`);
        }
      }

      // Admin-disabled accounts only — NOT expired validity. Deactivated staff are blocked too.
      if (user.status === 'Inactive') {
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

  // Single-device students: the first device that logs in is recorded; any other
  // device is refused until an admin resets it. Apps that do not send a device id
  // (older versions) cannot be checked, so they are refused for these students.
  async checkDevice(user: any, deviceId: unknown, deviceInfo: unknown): Promise<string | null> {
    if (user.role !== 'Student' || user.login_type !== 'Single') return null;
    const id = typeof deviceId === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(deviceId) ? deviceId : null;
    if (!id) throw new UnauthorizedException('This account can only be used on one registered device. Please update the app to the latest version and try again.');
    if (user.device_id && user.device_id !== id) {
      throw new UnauthorizedException('This account is registered on another device. Please contact the institute to use it on this device.');
    }
    if (!user.device_id) {
      const info = typeof deviceInfo === 'string' ? deviceInfo.slice(0, 150) : null;
      await this.usersService.update(user.id, { device_id: id, device_info: info, device_bound_at: new Date() });
    }
    return id;
  }

  async login(user: any, deviceId: string | null = null) {
    const payload = {
      did: deviceId || undefined,
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
    if (!userData?.username || !userData?.password) throw new BadRequestException('Username and password are required.');
    const existing = await this.usersService.findOne(userData.username);
    if (existing) {
      throw new ConflictException('Username already exists');
    }

    const { password, username } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Public endpoint: only the sign-up form's own fields are accepted. Anything
    // else (role, permissions, validity, limits, status…) is ignored, so a new
    // account is always a plain Student.
    const text = (v: any) => (v === undefined || v === null ? undefined : String(v).trim());
    const user = await this.usersService.create({
      name: text(userData.name),
      phone: text(userData.phone),
      city: text(userData.city),
      state: text(userData.state),
      fathers_name: text(userData.fathers_name ?? userData.father_name),
      role: UserRole.STUDENT,
      user_id: username,
      password_hash: hashedPassword,
      status: UserStatus.ACTIVE,
    });

    const { password_hash, ...result } = user;
    return result;
  }
}
