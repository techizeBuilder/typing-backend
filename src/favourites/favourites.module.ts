import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavouritesController } from './favourites.controller';
import { FavouritesService } from './favourites.service';
import { StudentFavourite, StudentFolder, StudentFolderItem } from '../entities/favourite.entity';
import { Chapter } from '../entities/chapter.entity';
import { Exam } from '../entities/exam.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StudentFavourite, StudentFolder, StudentFolderItem, Chapter, Exam])],
  controllers: [FavouritesController],
  providers: [FavouritesService],
})
export class FavouritesModule {}
