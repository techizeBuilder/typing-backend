import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthService } from '../auth/auth.service';
import { UserRole, UserStatus } from '../entities/user.entity';
import { StripSecretsInterceptor } from '../common/strip-secrets.interceptor';
import { of, lastValueFrom } from 'rxjs';

const uniqueViolation = Object.assign(new Error('dup'), { code: '23505' });

describe('UsersService', () => {
  const updates: any[] = [];
  const repo: any = {
    create: (d: any) => d,
    save: async () => { throw uniqueViolation; },
    update: async (id: string, d: any) => { updates.push(d); if (d.phone === 'dup') throw uniqueViolation; return { affected: 1 }; },
    findOneBy: async ({ user_id }: any) => (user_id === 'old' ? { status: UserStatus.ACTIVE, validity_end: '2000-01-01' } : null),
  };
  const svc = new UsersService(repo);

  it('duplicate phone / login ID is a 409, not a 500', async () => {
    await expect(svc.create({ user_id: 'x' })).rejects.toThrow(ConflictException);
    await expect(svc.update('id', { phone: 'dup' })).rejects.toThrow(ConflictException);
  });
  it('a blank password keeps the old one (no empty hash)', async () => {
    await svc.update('id', { name: 'A', password_hash: '' } as any);
    expect('password_hash' in updates[updates.length - 1]).toBe(false);
    await svc.update('id', { password_hash: 'secret12' } as any);
    expect(await bcrypt.compare('secret12', updates[updates.length - 1].password_hash)).toBe(true);
  });
  it('expired students show as Inactive', async () => {
    expect((await svc.findOne('old'))?.status).toBe(UserStatus.INACTIVE);
  });
});

describe('who may manage which accounts', () => {
  const stored: Record<string, any> = {
    stu: { id: 'stu', role: UserRole.STUDENT },
    adm: { id: 'adm', role: UserRole.ADMIN, permissions: [] },
    sup: { id: 'sup', role: UserRole.SUPERADMIN },
    sub: { id: 'sub', role: UserRole.SUBADMIN, permissions: ['students'] },
  };
  const svc: any = {
    findById: async (id: string) => stored[id] || null,
    update: jest.fn(async () => ({ affected: 1 })),
    create: jest.fn(async (d: any) => d),
    remove: jest.fn(async () => ({ deleted: true })),
    findAll: async () => Object.values(stored),
  };
  const ctl = new UsersController(svc);
  const as = (userId: string, role: UserRole, permissions: string[] = []) => ({ user: { userId, role, permissions } });

  it('only a Super Admin manages Super Admins', async () => {
    await expect(ctl.update(as('adm', UserRole.ADMIN), 'sup', { name: 'x' })).rejects.toThrow(ForbiddenException);
    await expect(ctl.create(as('adm', UserRole.ADMIN), { role: UserRole.SUPERADMIN } as any)).rejects.toThrow(ForbiddenException);
  });
  it('sub-admins need the matching module and cannot touch Admins', async () => {
    await expect(ctl.update(as('sub', UserRole.SUBADMIN, ['students']), 'stu', { name: 'x' })).resolves.toBeDefined();
    await expect(ctl.update(as('sub', UserRole.SUBADMIN, []), 'stu', { name: 'x' })).rejects.toThrow(ForbiddenException);
    await expect(ctl.update(as('sub', UserRole.SUBADMIN, ['students', 'staff']), 'adm', { name: 'x' })).rejects.toThrow(ForbiddenException);
    await expect(ctl.create(as('sub', UserRole.SUBADMIN, ['staff']), { role: UserRole.SUBADMIN, permissions: ['plans'] } as any)).rejects.toThrow(ForbiddenException);
  });
  it('nobody changes their own role or deletes themselves', async () => {
    await expect(ctl.update(as('adm', UserRole.ADMIN), 'adm', { role: UserRole.SUPERADMIN } as any)).rejects.toThrow(ForbiddenException);
    await expect(ctl.remove(as('adm', UserRole.ADMIN), 'adm')).rejects.toThrow(ForbiddenException);
  });
  it('unknown roles are rejected', async () => {
    await expect(ctl.create(as('adm', UserRole.ADMIN), { role: 'God' } as any)).rejects.toThrow(BadRequestException);
  });
  it('a student may only edit safe profile fields', async () => {
    await ctl.updateProfile({ user: { userId: 'stu' } }, { name: 'New', role: UserRole.ADMIN, validity_end: '2999-01-01', status: 'Active' } as any);
    expect(svc.update).toHaveBeenLastCalledWith('stu', { name: 'New' });
  });
  it('sub-admins without Staff only see students in the list', async () => {
    const list = await ctl.findAll(as('sub', UserRole.SUBADMIN, ['students']));
    expect(list.every((u: any) => u.role === UserRole.STUDENT)).toBe(true);
  });
});

describe('AuthService', () => {
  const hash = bcrypt.hashSync('pass1234', 4);
  const users: Record<string, any> = {
    ok: { id: '1', user_id: 'ok', role: 'Student', status: 'Active', password_hash: hash, validity_end: '2000-01-01' },
    off: { id: '2', user_id: 'off', role: 'Student', status: 'Inactive', password_hash: hash },
    night: { id: '3', user_id: 'night', role: 'Student', status: 'Active', password_hash: hash, allowed_login_time_start: '00:00', allowed_login_time_end: '00:01' },
    single: { id: '4', user_id: 'single', role: 'Student', status: 'Active', password_hash: hash, login_type: 'Single', device_id: 'aaaaaaaaaaaaaaaa' },
  };
  const usersService: any = {
    findOneRaw: async (u: string) => users[u] || null,
    findOne: async (u: string) => users[u] || null,
    update: jest.fn(async () => ({})),
    create: jest.fn(async (d: any) => ({ id: 'n', ...d })),
  };
  const auth = new AuthService(usersService, { sign: (p: any) => JSON.stringify(p) } as any);

  it('expired validity does not block login, but marks premium expired', async () => {
    const u = await auth.validateUser('ok', 'pass1234');
    expect(u.premium_expired).toBe(true);
    expect(u.password_hash).toBeUndefined();
  });
  it('wrong password, inactive account, and login window', async () => {
    expect(await auth.validateUser('ok', 'nope')).toBeNull();
    await expect(auth.validateUser('off', 'pass1234')).rejects.toThrow(UnauthorizedException);
    await expect(auth.validateUser('night', 'pass1234')).rejects.toThrow(UnauthorizedException);
  });
  it('single-device students: bound device only', async () => {
    await expect(auth.checkDevice(users.single, 'bbbbbbbbbbbbbbbb', '')).rejects.toThrow(UnauthorizedException);
    await expect(auth.checkDevice(users.single, null, '')).rejects.toThrow(UnauthorizedException);
    await expect(auth.checkDevice(users.single, 'aaaaaaaaaaaaaaaa', '')).resolves.toBe('aaaaaaaaaaaaaaaa');
    expect(await auth.checkDevice(users.ok, null, '')).toBeNull();
  });
  it('public sign-up always makes a plain student', async () => {
    await auth.signup({ username: 'newbie', password: 'pass1234', role: 'Admin', validity_end: '2999-01-01', permissions: ['staff'] });
    const made = usersService.create.mock.calls[0][0];
    expect(made.role).toBe(UserRole.STUDENT);
    expect(made.validity_end).toBeUndefined();
    expect(made.permissions).toBeUndefined();
    await expect(auth.signup({ username: 'ok', password: 'x' })).rejects.toThrow();
    await expect(auth.signup({})).rejects.toThrow(BadRequestException);
  });
});

describe('secrets never leave the API', () => {
  it('strips password hashes and device ids at any depth', async () => {
    const data = { a: [{ user: { name: 'x', password_hash: 'h', device_id: 'd', device_info: 'Chrome' } }], when: new Date() };
    const out: any = await lastValueFrom(new StripSecretsInterceptor().intercept({} as any, { handle: () => of(data) }));
    expect(out.a[0].user).toEqual({ name: 'x', device_info: 'Chrome' });
    expect(out.when).toBeInstanceOf(Date);
  });
});
