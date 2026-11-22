import { BadRequestException } from '@nestjs/common';
import { addDays, dateOnly, inWindow, isValidTimeZone, validityEnded, zonedDate, zonedDayEnd, zonedDayStart, zonedNow, zonedToUtc } from './zoned-time';
import { hasPremiumAccess } from './premium';
import { cleanBanner, cleanChapterInfo, cleanExamInfo, cleanStudentExtras } from './management-fields';
import { normalizeChoice, EXAM_REGIONS } from './exam-extras';
import { UserRole } from '../entities/user.entity';

describe('India time helpers (independent of the server time zone)', () => {
  it('reads the wall clock in India', () => {
    expect(zonedNow(new Date('2026-11-01T18:45:00Z'))).toEqual({ date: '2026-11-02', minutes: 15 });
    expect(zonedDate('2026-11-01T18:29:00Z')).toBe('2026-11-01');
    expect(zonedDate('2026-11-01T18:30:00Z')).toBe('2026-11-02');
  });
  it('converts India wall time to an instant', () => {
    expect(zonedToUtc('2026-11-02', 21 * 60).toISOString()).toBe('2026-11-02T15:30:00.000Z');
    expect(zonedDayStart('2026-11-02').toISOString()).toBe('2026-11-01T18:30:00.000Z');
    expect(zonedDayEnd('2026-11-02').toISOString()).toBe('2026-11-02T18:29:59.999Z');
    expect(zonedToUtc('2026-07-01', 0, 'Europe/London').toISOString()).toBe('2026-06-30T23:00:00.000Z');
  });
  it('calendar helpers', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dateOnly('2026-11-02')).toBe('2026-11-02');
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
    expect(zonedNow(new Date('2026-11-01T00:00:00Z'), 'Mars/Base').date).toBe('2026-11-01');
  });
  it('login windows, including ones that cross midnight', () => {
    expect(inWindow(600, '09:00', '17:00')).toBe(true);
    expect(inWindow(1080, '09:00', '17:00')).toBe(false);
    expect(inWindow(30, '22:00', '02:00')).toBe(true);
    expect(inWindow(720, '22:00', '02:00')).toBe(false);
  });
  it('validity lasts the whole end day, India time', () => {
    expect(validityEnded('2026-11-02', new Date('2026-11-02T18:29:00Z'))).toBe(false);
    expect(validityEnded('2026-11-02', new Date('2026-11-02T18:31:00Z'))).toBe(true);
    expect(validityEnded(null)).toBe(false);
  });
});

describe('premium access', () => {
  it('staff always, students until the end date', () => {
    expect(hasPremiumAccess({ role: UserRole.ADMIN, validity_end: null as any })).toBe(true);
    expect(hasPremiumAccess({ role: UserRole.STUDENT, validity_end: null as any })).toBe(false);
    expect(hasPremiumAccess({ role: UserRole.STUDENT, validity_end: '2999-01-01' as any })).toBe(true);
    expect(hasPremiumAccess({ role: UserRole.STUDENT, validity_end: '2000-01-01' as any })).toBe(false);
    expect(hasPremiumAccess(null)).toBe(false);
  });
});

describe('management field validation', () => {
  it('students: trims, validates, never lets a device lock through', () => {
    const d: any = { email: ' a@b.co ', pin_code: '110001', guardian_phone: '9876543210', device_id: 'x', login_type: '', city: '' };
    cleanStudentExtras(d);
    expect(d).toMatchObject({ email: 'a@b.co', login_type: 'Multiple', city: null });
    expect(d.device_id).toBeUndefined();
    expect(() => cleanStudentExtras({ email: 'nope' })).toThrow(BadRequestException);
    expect(() => cleanStudentExtras({ pin_code: '12' })).toThrow(BadRequestException);
    expect(() => cleanStudentExtras({ login_type: 'Both' })).toThrow(BadRequestException);
    expect(() => cleanStudentExtras({ login_timezone: 'Mars/Base' })).toThrow(BadRequestException);
    expect(() => cleanStudentExtras({ allowed_login_time_start: '25:00' })).toThrow(BadRequestException);
  });
  it('exams and tests', () => {
    const e: any = { exam_level: '  Group C  ', card_tags: '', is_pro_level: 'true' };
    cleanExamInfo(e);
    expect(e).toEqual({ exam_level: 'Group C', card_tags: null, is_pro_level: true });
    expect(() => cleanExamInfo({ exam_level: 'x'.repeat(151) })).toThrow(BadRequestException);
    const c: any = { volume: 'Volume 1', is_active: 'false' };
    cleanChapterInfo(c);
    expect(c).toEqual({ volume: 'Volume 1', is_active: false });
    expect(() => cleanChapterInfo({ volume: 'x'.repeat(61) })).toThrow(BadRequestException);
  });
  it('banners: message required, safe links only, sane dates', () => {
    expect(() => cleanBanner({ content: ' ' }, true)).toThrow(BadRequestException);
    expect(() => cleanBanner({ content: 'Hi', link_url: 'javascript:alert(1)' }, true)).toThrow(BadRequestException);
    expect(() => cleanBanner({ content: 'Hi', color: 'red' }, true)).toThrow(BadRequestException);
    expect(() => cleanBanner({ content: 'Hi', start_date: '2026-11-05', end_date: '2026-11-01' }, true)).toThrow(BadRequestException);
    expect(() => cleanBanner({ content: 'Hi', link_url: '/plans', color: '#0D6EFD' }, true)).not.toThrow();
  });
  it('choices', () => {
    const d: any = { region: '' };
    normalizeChoice(d, 'region', EXAM_REGIONS);
    expect(d.region).toBeNull();
    expect(() => normalizeChoice({ region: 'Goa' }, 'region', EXAM_REGIONS)).toThrow(BadRequestException);
    const untouched: any = {};
    normalizeChoice(untouched, 'region', EXAM_REGIONS);
    expect('region' in untouched).toBe(false);
  });
});
