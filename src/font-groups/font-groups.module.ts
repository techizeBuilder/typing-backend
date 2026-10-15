import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FontGroupsController } from './font-groups.controller';
import { FontGroupsService } from './font-groups.service';
import { FontGroupSetting } from '../entities/font-group-setting.entity';
import { Chapter } from '../entities/chapter.entity';
import { Exam } from '../entities/exam.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FontGroupSetting, Chapter, Exam, User])],
  controllers: [FontGroupsController],
  providers: [FontGroupsService],
})
export class FontGroupsModule {}
