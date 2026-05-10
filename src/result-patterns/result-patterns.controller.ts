import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ResultPatternsService } from './result-patterns.service';
import { ResultPattern } from '../entities/result_pattern.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('result-patterns')
export class ResultPatternsController {
  constructor(private readonly resultPatternsService: ResultPatternsService) {}

  @Get()
  findAll(): Promise<ResultPattern[]> {
    return this.resultPatternsService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  create(@Body() patternData: Partial<ResultPattern>): Promise<ResultPattern> {
    return this.resultPatternsService.create(patternData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  update(@Param('id') id: string, @Body() patternData: Partial<ResultPattern>): Promise<any> {
    return this.resultPatternsService.update(id, patternData);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ResultPattern | null> {
    return this.resultPatternsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUBADMIN)
  remove(@Param('id') id: string): Promise<any> {
    return this.resultPatternsService.remove(id);
  }
}
