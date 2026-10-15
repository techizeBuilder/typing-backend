import { Controller, Get, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FontGroupsService } from './font-groups.service';

@Controller('font-groups')
export class FontGroupsController {
  constructor(private readonly fontGroups: FontGroupsService) {}

  // Public: which built-in groups are offered (students' mode choices).
  @Get()
  list() {
    return this.fontGroups.list();
  }

  // Staff: settings plus test / exam usage counts.
  @Get('admin')
  @UseGuards(JwtAuthGuard)
  async admin(@Request() req) {
    await this.fontGroups.assertStaff(req.user.userId);
    return this.fontGroups.listWithUsage();
  }

  // Staff: description, preview text, active / inactive.
  @Patch(':value')
  @UseGuards(JwtAuthGuard)
  async update(@Request() req, @Param('value') value: string, @Body() body: any) {
    await this.fontGroups.assertStaff(req.user.userId);
    return this.fontGroups.update(value, body);
  }
}
