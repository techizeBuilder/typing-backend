import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { User } from '../entities/user.entity';
import { PlanSubscription } from '../entities/plan.entity';
import { ReferralCommission, ReferralPayout } from '../entities/referral.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, PlanSubscription, ReferralCommission, ReferralPayout]), SettingsModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
