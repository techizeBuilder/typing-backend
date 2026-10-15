import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as fs from 'fs';
import { join } from 'path';
import { Review, REVIEW_STATUSES } from '../entities/review.entity';
import { User, UserRole } from '../entities/user.entity';

export interface RequestUser {
  userId: string;
  role: string;
}

const MIN_LENGTH = 20;
const MAX_LENGTH = 600;
const PUBLIC_LIMIT = 30;

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Admins and super admins always; sub-admins only with the 'reviews' permission.
  async assertStaff(user: RequestUser): Promise<void> {
    const staff = await this.users.findOne({ where: { id: user.userId } });
    if (staff && (staff.role === UserRole.ADMIN || staff.role === UserRole.SUPERADMIN)) return;
    if (staff && staff.role === UserRole.SUBADMIN && (staff.permissions || []).includes('reviews')) return;
    throw new ForbiddenException('You do not have access to reviews.');
  }

  // Approved reviews for the public landing page. Only display fields are exposed.
  async listPublic() {
    const rows = await this.reviews.find({
      where: { status: 'Approved' },
      order: { updated_at: 'DESC' },
      take: PUBLIC_LIMIT,
    });
    const names = await this.studentNames(rows);
    return rows.map((r) => ({
      id: r.id,
      name: names.get(r.student_id)?.name || 'Student',
      designation: r.designation,
      exam: r.exam,
      rating: r.rating,
      message: r.message,
      photo_url: r.photo_url,
      created_at: r.created_at,
    }));
  }

  async getMine(user: RequestUser) {
    return (await this.reviews.findOne({ where: { student_id: user.userId } })) || null;
  }

  // Create or update the student's single review; any change needs re-approval.
  async saveMine(
    user: RequestUser,
    body: { rating?: string | number; exam?: string; designation?: string; message?: string; remove_photo?: string },
    photoUrl: string | null,
  ) {
    const rating = Number(body.rating);
    const exam = (body.exam || '').trim();
    const message = (body.message || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('Please choose a rating from 1 to 5 stars.');
    if (!exam) throw new BadRequestException('Please choose your target exam.');
    if (message.length < MIN_LENGTH) throw new BadRequestException(`Please write at least ${MIN_LENGTH} characters.`);
    if (message.length > MAX_LENGTH) throw new BadRequestException(`Please keep your review under ${MAX_LENGTH} characters.`);

    const existing = await this.reviews.findOne({ where: { student_id: user.userId } });
    let photo = existing?.photo_url || null;
    if (photoUrl || body.remove_photo === 'true') {
      if (photo) this.deleteUpload(photo);
      photo = photoUrl;
    }
    const review = this.reviews.create({
      ...(existing || {}),
      student_id: user.userId,
      rating,
      exam: exam.slice(0, 150),
      designation: (body.designation || '').trim().slice(0, 150) || null,
      message,
      photo_url: photo,
      status: 'Pending',
    });
    return this.reviews.save(review);
  }

  async listAll(user: RequestUser) {
    await this.assertStaff(user);
    const rows = await this.reviews.find({ order: { updated_at: 'DESC' } });
    const students = await this.studentNames(rows);
    return rows.map((r) => ({ ...r, student: students.get(r.student_id) || null }));
  }

  async setStatus(user: RequestUser, id: string, status: string) {
    await this.assertStaff(user);
    if (!(REVIEW_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Invalid status.');
    const review = await this.reviews.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found.');
    review.status = status;
    return this.reviews.save(review);
  }

  async remove(user: RequestUser, id: string) {
    await this.assertStaff(user);
    const review = await this.reviews.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found.');
    if (review.photo_url) this.deleteUpload(review.photo_url);
    await this.reviews.delete(id);
    return { deleted: true };
  }

  private async studentNames(rows: Review[]) {
    if (rows.length === 0) return new Map<string, Pick<User, 'id' | 'name' | 'user_id' | 'phone'>>();
    const students = await this.users.find({
      where: { id: In([...new Set(rows.map((r) => r.student_id))]) },
      select: ['id', 'name', 'user_id', 'phone'],
    });
    return new Map(students.map((s) => [s.id, s]));
  }

  private deleteUpload(url: string) {
    if (!url.startsWith('/uploads/reviews/')) return;
    fs.promises.unlink(join('.', url)).catch(() => {});
  }
}
