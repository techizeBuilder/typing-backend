import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    // Run this migration as a background task so it never blocks NestJS startup.
    // Awaiting ALTER TABLE inside onModuleInit prevents app.listen() from being
    // called if the users table has an active lock (e.g. after a server restart
    // with in-flight queries), which causes all frontend requests to fail with
    // "Network Error". setImmediate defers to the next event loop tick so the
    // HTTP server starts immediately while the migration runs in parallel.
    setImmediate(async () => {
      try {
        await this.usersRepository.query(
          `ALTER TABLE users ALTER COLUMN category TYPE varchar(500) USING category::text`,
        );
      } catch {
        // Already varchar, lock timeout, or migration already applied — safe to ignore.
      }
    });
  }

  private applyDynamicStatus(user: User | null): User | null {
    if (!user) return user;
    if (user.status === UserStatus.ACTIVE && user.validity_end) {
      const now = new Date();
      const endDate = new Date(user.validity_end);
      endDate.setHours(23, 59, 59, 999);
      if (now > endDate) {
        user.status = UserStatus.INACTIVE;
      }
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    const users = await this.usersRepository.find();
    return users.map(u => this.applyDynamicStatus(u) as User);
  }

  async findOne(identifier: string): Promise<User | null> {
    // Try to find by user_id first, then by phone
    let user = await this.usersRepository.findOneBy({ user_id: identifier });
    if (!user) {
      user = await this.usersRepository.findOneBy({ phone: identifier });
    }
    return this.applyDynamicStatus(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.usersRepository.findOneBy({ id });
    return this.applyDynamicStatus(user);
  }

  async create(userData: Partial<User>): Promise<User> {
    try {
      const user = this.usersRepository.create(userData);
      return await this.usersRepository.save(user);
    } catch (err) {
      // Surface a meaningful message instead of a raw 500 so the admin UI can
      // explain *why* (e.g. duplicate phone/user_id, missing required field).
      const detail = err?.message || String(err);
      if (err?.code === '23505') {
        // Postgres unique_violation — phone or user_id already exists.
        throw new InternalServerErrorException(
          `Could not create staff member: a user with this phone number or login ID already exists.`,
        );
      }
      throw new InternalServerErrorException(`Create failed: ${detail}`);
    }
  }

  async update(id: string, userData: Partial<User>): Promise<any> {
    if (userData.password_hash) {
      userData.password_hash = await bcrypt.hash(userData.password_hash, 10);
    }
    try {
      return await this.usersRepository.update(id, userData);
    } catch (err) {
      const detail = err?.message || String(err);
      throw new InternalServerErrorException(`Update failed: ${detail}`);
    }
  }
}
