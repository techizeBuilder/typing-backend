import { Controller, Get, Post, Body, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiAnalysisService } from './ai-analysis.service';
import { User, UserRole } from '../entities/user.entity';

@Controller('ai-analysis')
@UseGuards(JwtAuthGuard)
export class AiAnalysisController {
  constructor(
    private readonly ai: AiAnalysisService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Student: is AI analysis available, and how many are left today.
  @Get('status')
  status(@Request() req) {
    return this.ai.status(req.user.userId);
  }

  // Student: analyse one result (numbers from the result screen).
  @Post()
  analyse(@Request() req, @Body() body: any) {
    return this.ai.analyse(req.user.userId, body);
  }

  // Admins: usage and token totals.
  @Get('usage')
  async usage(@Request() req) {
    const u = await this.users.findOne({ where: { id: req.user.userId } });
    if (!u || (u.role !== UserRole.ADMIN && u.role !== UserRole.SUPERADMIN)) throw new ForbiddenException();
    return this.ai.usage();
  }
}
