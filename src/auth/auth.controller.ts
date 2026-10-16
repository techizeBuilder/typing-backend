import { Controller, Post, Body, UnauthorizedException, BadRequestException, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ReferralsService } from '../referrals/referrals.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private referrals: ReferralsService) { }

  @Post('signup')
  async signup(@Body() userData: any) {
    const user = await this.authService.signup(userData);
    if (userData?.ref) await this.referrals.attributeOnSignup(user.id, userData.ref).catch(() => {});
    return user;
  }

  @Post('login')
  @HttpCode(200) // Return 200 instead of 201
  async login(@Body() loginData: any) {
    // Support both username and phone login
    const identifier = loginData?.username || loginData?.phone;
    if (typeof identifier !== 'string' || !identifier.trim() || typeof loginData?.password !== 'string' || !loginData.password) {
      throw new BadRequestException('Username and password are required.');
    }
    const user = await this.authService.validateUser(identifier, loginData.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.authService.login(user);
    return {
      success: true,
      message: 'Login successful',
      access_token: result.access_token,
      user: {
        id: user.id,
        user_id: user.user_id,
        name: user.name,
        roll_no: user.roll_no,
        role: user.role,
        phone: user.phone
      }
    };
  }
}
