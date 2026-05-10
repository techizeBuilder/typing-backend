import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ExamsModule } from './exams/exams.module';
import { ChaptersModule } from './chapters/chapters.module';
import { ResultsModule } from './results/results.module';
import { AuthModule } from './auth/auth.module';
import { User } from './entities/user.entity';
import { Exam } from './entities/exam.entity';
import { Chapter } from './entities/chapter.entity';
import { Result } from './entities/result.entity';
import { ResultPattern } from './entities/result_pattern.entity';
import { Message } from './entities/message.entity';
import { FlashBanner } from './entities/flash_banner.entity';
import { ResultPatternsModule } from './result-patterns/result-patterns.module';
import { MessagesModule } from './messages/messages.module';
import { FlashBannersModule } from './flash-banners/flash-banners.module';

// Create DataSource exactly like the working test
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'typing_app_db',
  entities: [User, Exam, Chapter, Result, ResultPattern, Message, FlashBanner],
  synchronize: true,
  logging: false,
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      database: 'typing_master',
      entities: [User, Exam, Chapter, Result, ResultPattern, Message, FlashBanner],
      synchronize: false,  // TURN OFF AUTO-SYNC
      logging: false,
    }),
    UsersModule,
    ExamsModule,
    ChaptersModule,
    ResultsModule,
    AuthModule,
    ResultPatternsModule,
    MessagesModule,
    FlashBannersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
