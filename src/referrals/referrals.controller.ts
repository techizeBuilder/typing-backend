import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  // Public: validate a code for the sign-up page.
  @Get('check')
  check(@Query('code') code: string) {
    return this.referrals.check(code);
  }

  // Student: code, earnings, referred students, payouts.
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Request() req) {
    return this.referrals.mine(req.user.userId);
  }

  @Post('payouts')
  @UseGuards(JwtAuthGuard)
  requestPayout(@Request() req, @Body() body: any) {
    return this.referrals.requestPayout(req.user.userId, body);
  }

  // Staff ('plans' permission)
  @Get('admin')
  @UseGuards(JwtAuthGuard)
  async admin(@Request() req) {
    await this.referrals.assertStaff(req.user.userId);
    return this.referrals.overview();
  }

  @Post('payouts/:id/paid')
  @UseGuards(JwtAuthGuard)
  async paid(@Request() req, @Param('id') id: string, @Body() body: any) {
    await this.referrals.assertStaff(req.user.userId);
    return this.referrals.markPaid(req.user.userId, id, body);
  }

  @Post('payouts/:id/reject')
  @UseGuards(JwtAuthGuard)
  async reject(@Request() req, @Param('id') id: string, @Body() body: any) {
    await this.referrals.assertStaff(req.user.userId);
    return this.referrals.reject(req.user.userId, id, body);
  }
}
