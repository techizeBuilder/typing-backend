import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  // Public: active plans for the pricing page (also shown to signed-out / expired students).
  @Get()
  list() {
    return this.plans.listPublic();
  }

  // ── Student ──
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Request() req) {
    return this.plans.mine(req.user.userId);
  }

  @Post(':id/request')
  @UseGuards(JwtAuthGuard)
  request(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.plans.request(req.user.userId, id, body?.note);
  }

  @Post('requests/:id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Request() req, @Param('id') id: string) {
    return this.plans.cancel(req.user.userId, id);
  }

  // ── Staff ──
  @Get('admin')
  @UseGuards(JwtAuthGuard)
  async adminList(@Request() req) {
    await this.plans.assertStaff(req.user.userId);
    return this.plans.listAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req, @Body() body: any) {
    await this.plans.assertStaff(req.user.userId);
    return this.plans.createPlan(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Request() req, @Param('id') id: string, @Body() body: any) {
    await this.plans.assertStaff(req.user.userId);
    return this.plans.updatePlan(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Request() req, @Param('id') id: string) {
    await this.plans.assertStaff(req.user.userId);
    return this.plans.deletePlan(id);
  }

  @Get('subscriptions/all')
  @UseGuards(JwtAuthGuard)
  async subscriptions(@Request() req) {
    await this.plans.assertStaff(req.user.userId);
    return this.plans.listSubscriptions();
  }

  @Post('subscriptions')
  @UseGuards(JwtAuthGuard)
  async assign(@Request() req, @Body() body: any) {
    await this.plans.assertStaff(req.user.userId);
    return this.plans.assign(req.user.userId, body);
  }

  @Post('subscriptions/:id/activate')
  @UseGuards(JwtAuthGuard)
  async activate(@Request() req, @Param('id') id: string, @Body() body: any) {
    await this.plans.assertStaff(req.user.userId);
    return this.plans.activate(req.user.userId, id, body);
  }

  @Post('subscriptions/:id/reject')
  @UseGuards(JwtAuthGuard)
  async reject(@Request() req, @Param('id') id: string, @Body() body: any) {
    await this.plans.assertStaff(req.user.userId);
    return this.plans.reject(id, body);
  }
}
