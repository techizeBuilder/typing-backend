import { BadRequestException } from '@nestjs/common';

// Validation for the optional management fields added in 8.18 (students, exams,
// tests and flash banners). Empty strings become null so a field can be cleared.

const text = (d: any, key: string, max: number, label: string) => {
  if (d[key] === undefined) return;
  if (d[key] === null) return;
  const v = String(d[key]).trim();
  if (v.length > max) throw new BadRequestException(`${label} must be at most ${max} characters.`);
  d[key] = v === '' ? null : v;
};
const pattern = (d: any, key: string, re: RegExp, message: string) => {
  if (d[key] != null && !re.test(d[key])) throw new BadRequestException(message);
};
const bool = (d: any, key: string) => {
  if (d[key] !== undefined && d[key] !== null) d[key] = d[key] === true || d[key] === 'true';
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function cleanStudentExtras(d: any) {
  if (!d) return;
  text(d, 'email', 120, 'Email');
  text(d, 'address', 300, 'Address');
  text(d, 'pin_code', 10, 'Pin code');
  text(d, 'guardian_phone', 15, 'Guardian mobile');
  text(d, 'remarks', 500, 'Remarks');
  text(d, 'city', 100, 'City');
  text(d, 'state', 100, 'State');
  pattern(d, 'email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.');
  pattern(d, 'pin_code', /^\d{6}$/, 'Pin code must be 6 digits.');
  pattern(d, 'guardian_phone', /^\+?\d{10,13}$/, 'Guardian mobile must be 10 digits.');
}

export function cleanExamInfo(d: any) {
  if (!d) return;
  text(d, 'display_title', 150, 'Display title');
  text(d, 'conducted_by', 150, 'Conducted by');
  text(d, 'mistake_policy', 200, 'Mistake policy');
  bool(d, 'is_active');
}

export function cleanChapterInfo(d: any) {
  if (!d) return;
  text(d, 'name', 150, 'Test title');
  text(d, 'description', 500, 'Description');
  bool(d, 'is_active');
}

export function cleanBanner(d: any, creating: boolean) {
  if (!d) return;
  if (creating && !String(d.content ?? '').trim()) throw new BadRequestException('Banner message is required.');
  if (d.content !== undefined && !String(d.content ?? '').trim()) throw new BadRequestException('Banner message is required.');
  text(d, 'title', 80, 'Banner title');
  text(d, 'link_url', 300, 'Link');
  text(d, 'color', 7, 'Banner colour');
  text(d, 'start_date', 10, 'Start date');
  text(d, 'end_date', 10, 'End date');
  // Only site paths or web links: never javascript:/data: URLs.
  pattern(d, 'link_url', /^(\/[^\s]*|https?:\/\/[^\s]+)$/i, 'Link must start with / or http(s)://');
  pattern(d, 'color', /^#[0-9a-fA-F]{6}$/, 'Colour must be a hex value like #0D6EFD.');
  pattern(d, 'start_date', DATE, 'Start date must be YYYY-MM-DD.');
  pattern(d, 'end_date', DATE, 'End date must be YYYY-MM-DD.');
  if (d.start_date && d.end_date && d.end_date < d.start_date) throw new BadRequestException('End date cannot be before the start date.');
  bool(d, 'is_active');
}
