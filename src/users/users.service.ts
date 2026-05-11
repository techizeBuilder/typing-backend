import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

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
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<any> {
    if (userData.password_hash) {
      userData.password_hash = await bcrypt.hash(userData.password_hash, 10);
    }
    return this.usersRepository.update(id, userData);
  }
}
