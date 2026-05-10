import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashBannersService } from './flash-banners.service';
import { FlashBannersController } from './flash-banners.controller';
import { FlashBanner } from '../entities/flash_banner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FlashBanner])],
  controllers: [FlashBannersController],
  providers: [FlashBannersService],
})
export class FlashBannersModule {}
