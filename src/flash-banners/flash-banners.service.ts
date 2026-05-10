import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashBanner } from '../entities/flash_banner.entity';

@Injectable()
export class FlashBannersService {
  constructor(
    @InjectRepository(FlashBanner)
    private readonly repository: Repository<FlashBanner>,
  ) {}

  findAll(): Promise<FlashBanner[]> {
    return this.repository.find({ order: { created_at: 'DESC' } });
  }

  getActive(): Promise<FlashBanner[]> {
    return this.repository.find({ where: { is_active: true }, order: { created_at: 'DESC' } });
  }

  create(data: Partial<FlashBanner>): Promise<FlashBanner> {
    const banner = this.repository.create(data);
    return this.repository.save(banner);
  }

  async update(id: string, data: Partial<FlashBanner>): Promise<any> {
    return this.repository.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
