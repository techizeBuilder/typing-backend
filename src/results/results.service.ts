import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result } from '../entities/result.entity';

@Injectable()
export class ResultsService {
  constructor(
    @InjectRepository(Result)
    private resultsRepository: Repository<Result>,
  ) {}

  findByUser(userId: string): Promise<Result[]> {
    return this.resultsRepository.find({
      where: { student_id: userId },
      relations: ['exam'],
      order: { date_taken: 'DESC' },
    });
  }

  findAll(): Promise<Result[]> {
    return this.resultsRepository.find({
      relations: ['exam'],
      order: { date_taken: 'DESC' },
    });
  }

  create(resultData: Partial<Result>): Promise<Result> {
    const result = this.resultsRepository.create(resultData);
    return this.resultsRepository.save(result);
  }

  async getLeaderboard(): Promise<any[]> {
    // Fetch all Live Test results ordered by NWPM DESC
    const rawResults = await this.resultsRepository.createQueryBuilder('result')
      .select('users.name', 'username')
      .addSelect('result.nwpm', 'max_nwpm')
      .addSelect('result.accuracy', 'max_accuracy')
      .innerJoin('users', 'users', 'users.id = result.student_id')
      .innerJoin('chapters', 'chapters', 'chapters.id = result.chapter_id')
      .where('chapters.test_type = :testType', { testType: 'Live Test' })
      .orderBy('result.nwpm', 'DESC')
      .getRawMany();

    // Deduplicate by user to only keep their best score
    const uniqueUsers = new Set();
    const leaderboard: any[] = [];
    for (const row of rawResults) {
      if (!uniqueUsers.has(row.username)) {
        uniqueUsers.add(row.username);
        leaderboard.push(row);
        if (leaderboard.length >= 10) break;
      }
    }
    return leaderboard;
  }
}
