import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  SupportTicket,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../entities/support_ticket.entity';
import { SupportReply, SupportAttachment } from '../entities/support_reply.entity';
import { User, UserRole } from '../entities/user.entity';

export interface RequestUser {
  userId: string;
  role: string;
}

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket) private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportReply) private readonly replies: Repository<SupportReply>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Admins and super admins always; sub-admins only with the 'support' permission.
  async assertStaff(user: RequestUser): Promise<User> {
    const staff = await this.users.findOne({ where: { id: user.userId } });
    if (!staff) throw new ForbiddenException();
    if (staff.role === UserRole.ADMIN || staff.role === UserRole.SUPERADMIN) return staff;
    if (staff.role === UserRole.SUBADMIN && (staff.permissions || []).includes('support')) return staff;
    throw new ForbiddenException('You do not have access to support tickets.');
  }

  async create(
    user: RequestUser,
    body: { subject?: string; category?: string; priority?: string; message?: string },
    attachments: SupportAttachment[],
  ) {
    const subject = (body.subject || '').trim();
    const message = (body.message || '').trim();
    if (!subject) throw new BadRequestException('Subject is required.');
    if (!message) throw new BadRequestException('Please describe the problem.');
    const author = await this.users.findOne({ where: { id: user.userId } });
    const ticket = await this.tickets.save(this.tickets.create({
      student_id: user.userId,
      subject: subject.slice(0, 200),
      category: (TICKET_CATEGORIES as readonly string[]).includes(body.category || '') ? body.category : 'Other',
      priority: (TICKET_PRIORITIES as readonly string[]).includes(body.priority || '') ? body.priority : 'Medium',
      status: 'Open',
    }));
    await this.replies.save(this.replies.create({
      ticket_id: ticket.id,
      author_id: user.userId,
      author_type: 'student',
      author_name: author?.name || author?.user_id || 'Student',
      message,
      attachments,
    }));
    return this.findOneWithReplies(ticket.id);
  }

  async listMine(user: RequestUser) {
    const rows = await this.tickets.find({ where: { student_id: user.userId }, order: { created_at: 'DESC' } });
    return this.withReplies(rows);
  }

  async listAll(user: RequestUser) {
    await this.assertStaff(user);
    const rows = await this.tickets.find({ order: { created_at: 'DESC' } });
    return this.withReplies(rows, true);
  }

  async reply(user: RequestUser, ticketId: string, message: string, attachments: SupportAttachment[]) {
    const text = (message || '').trim();
    if (!text && attachments.length === 0) throw new BadRequestException('Reply cannot be empty.');
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found.');

    const isOwner = ticket.student_id === user.userId;
    let authorType = 'student';
    let author: User | null;
    if (isOwner) {
      if (ticket.status === 'Resolved') throw new BadRequestException('This ticket is resolved. Please raise a new ticket.');
      author = await this.users.findOne({ where: { id: user.userId } });
    } else {
      author = await this.assertStaff(user);
      authorType = 'staff';
    }
    await this.replies.save(this.replies.create({
      ticket_id: ticket.id,
      author_id: user.userId,
      author_type: authorType,
      author_name: author?.name || author?.user_id || (authorType === 'staff' ? 'Support Team' : 'Student'),
      message: text,
      attachments,
    }));
    // A staff reply on an open ticket moves it to "In Progress"; a student reply re-opens it.
    if (authorType === 'staff' && ticket.status === 'Open') ticket.status = 'In Progress';
    if (authorType === 'student' && ticket.status === 'In Progress') ticket.status = 'Open';
    await this.tickets.save(ticket);
    return this.findOneWithReplies(ticket.id, authorType === 'staff');
  }

  async update(user: RequestUser, ticketId: string, body: { status?: string; priority?: string }) {
    await this.assertStaff(user);
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (body.status !== undefined) {
      if (!(TICKET_STATUSES as readonly string[]).includes(body.status)) throw new BadRequestException('Invalid status.');
      ticket.status = body.status;
    }
    if (body.priority !== undefined) {
      if (!(TICKET_PRIORITIES as readonly string[]).includes(body.priority)) throw new BadRequestException('Invalid priority.');
      ticket.priority = body.priority;
    }
    await this.tickets.save(ticket);
    return this.findOneWithReplies(ticket.id, true);
  }

  private async findOneWithReplies(id: string, withStudent = false) {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return (await this.withReplies([ticket], withStudent))[0];
  }

  private async withReplies(rows: SupportTicket[], withStudent = false) {
    if (rows.length === 0) return [];
    const ids = rows.map((t) => t.id);
    const replies = await this.replies.find({ where: { ticket_id: In(ids) }, order: { created_at: 'ASC' } });
    const students = withStudent
      ? await this.users.find({
          where: { id: In([...new Set(rows.map((t) => t.student_id))]) },
          select: ['id', 'name', 'user_id', 'roll_no', 'phone'],
        })
      : [];
    const studentById = new Map(students.map((s) => [s.id, s]));
    return rows.map((t) => ({
      ...t,
      replies: replies.filter((r) => r.ticket_id === t.id),
      ...(withStudent ? { student: studentById.get(t.student_id) || null } : {}),
    }));
  }
}
