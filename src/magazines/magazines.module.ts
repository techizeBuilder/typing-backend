import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MagazinesController } from './magazines.controller';
import { MagazinesService } from './magazines.service';
import { Magazine } from '../entities/magazine.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Magazine, User])],
  controllers: [MagazinesController],
  providers: [MagazinesService],
})
export class MagazinesModule {}
