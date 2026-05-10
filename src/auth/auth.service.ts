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
    const user = await this.usersService.findOne(username);
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      
      // Check for allowed time slots 
      if (user.role === 'Student' && user.allowed_login_time_start && user.allowed_login_time_end) {
        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        if (currentTime < user.allowed_login_time_start || currentTime > user.allowed_login_time_end) {
            throw new UnauthorizedException(`Login blocked. Please login between ${user.allowed_login_time_start} and ${user.allowed_login_time_end}`);
        }
      }

      // Check if student is active
      if (user.role === 'Student' && user.status === 'Inactive') {
        throw new UnauthorizedException('Your account is inactive. Please contact the administrator.');
      }

      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
      username: user.user_id, 
      sub: user.id, 
      role: user.role,
      permissions: user.permissions || [],
      validity_end: user.validity_end 
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
    });

    const { password_hash, ...result } = user;
    return result;
  }
}
