import { Controller, Post, Body, UnauthorizedException, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('signup')
  async signup(@Body() userData: any) {
    return this.authService.signup(userData);
  }

  @Post('login')
  @HttpCode(200) // Return 200 instead of 201
  async login(@Body() loginData: any) {
    // Support both username and phone login
    const identifier = loginData.username || loginData.phone;
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
        id: user.user_id,
        name: user.name,
        role: user.role,
        phone: user.phone
      }
    };
  }
}
