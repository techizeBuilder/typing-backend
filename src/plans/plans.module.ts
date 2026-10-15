import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { Plan, PlanSubscription } from '../entities/plan.entity';
import { User } from '../entities/user.entity';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [TypeOrmModule.forFeature([Plan, PlanSubscription, User]), ReferralsModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
