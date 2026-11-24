import { BadRequestException } from '@nestjs/common';
import { isValidTimeZone } from './zoned-time';

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
  // Login control. The bound device is never set through this route: it is
  // recorded at login and cleared with POST /users/:id/reset-device.
  delete d.device_id; delete d.device_info; delete d.device_bound_at;
  if (d.login_type !== undefined) {
    if (d.login_type === null || d.login_type === '') d.login_type = 'Multiple';
    if (!['Single', 'Multiple'].includes(d.login_type)) throw new BadRequestException('Login type must be Single or Multiple.');
  }
  text(d, 'login_timezone', 40, 'Time zone');
  if (d.login_timezone && !isValidTimeZone(d.login_timezone)) throw new BadRequestException('Unknown time zone.');
  for (const k of ['allowed_login_time_start', 'allowed_login_time_end']) {
    text(d, k, 8, 'Login time');
    pattern(d, k, /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Login times must be in HH:MM format.');
  }
}

export function cleanExamInfo(d: any) {
  if (!d) return;
  text(d, 'display_title', 150, 'Display title');
  text(d, 'conducted_by', 150, 'Conducted by');
  text(d, 'mistake_policy', 200, 'Mistake policy');
  text(d, 'exam_level', 150, 'Exam level');
  text(d, 'card_tags', 300, 'Card tags');
  cleanExamRules(d);
  bool(d, 'is_pro_level');
  bool(d, 'is_active');
}

// Multipart forms send objects as JSON strings; '' or null clears the field.
const json = (d: any, key: string, label: string) => {
  if (d[key] === undefined) return;
  let v = d[key];
  if (typeof v === 'string') {
    try { v = v.trim() === '' ? null : JSON.parse(v); } catch { throw new BadRequestException(`${label} is not valid.`); }
  }
  if (v !== null && (typeof v !== 'object' || Array.isArray(v))) throw new BadRequestException(`${label} is not valid.`);
  d[key] = v;
};
export const RESULT_COMPONENT_KEYS = [
  'show_test_words', 'show_total_words', 'show_test_strokes', 'show_total_strokes', 'show_correct_words', 'show_correct_strokes',
  'show_gross_speed', 'show_net_speed', 'show_kdph', 'show_accuracy', 'show_full_mistakes', 'show_half_mistakes', 'show_total_errors',
  'show_backspace_count', 'show_ignorable_mistakes', 'show_marks', 'show_rank',
];

export function cleanExamRules(d: any) {
  if (!d) return;
  json(d, 'language_rules', 'Passing criteria');
  if (d.language_rules) {
    const out: any = {};
    for (const [lang, label] of [['english', 'English'], ['hindi', 'Hindi']]) {
      const r = d.language_rules[lang];
      if (!r) continue;
      const n = (key: string, min: number, max: number, name: string, whole = false) => {
        const v = r[key] === '' || r[key] === null || r[key] === undefined ? NaN : Number(r[key]);
        if (!Number.isFinite(v) || v < min || v > max || (whole && !Number.isInteger(v))) {
          throw new BadRequestException(`${label}: ${name} must be a ${whole ? 'whole ' : ''}number from ${min} to ${max}.`);
        }
        return v;
      };
      const enabled = r.enabled === true || r.enabled === 'true';
      const rule: any = { enabled, min: n('min', 0, 1000000, 'Minimum Words / Strokes', true), max: n('max', 0, 1000000, 'Maximum Words / Strokes', true) };
      if (rule.max > 0 && rule.min > 0 && rule.max <= rule.min) throw new BadRequestException(`${label}: Maximum Words / Strokes must be greater than Minimum.`);
      if (!['NWPM', 'GWPM'].includes(r.qualify_on ?? 'NWPM')) throw new BadRequestException(`${label}: Result Mode is not valid.`);
      rule.qualify_on = r.qualify_on ?? 'NWPM';
      rule.required_speed = enabled ? n('required_speed', 0, 60000, 'Minimum Qualifying Speed') : Number(r.required_speed) || 0;
      rule.required_accuracy = enabled ? n('required_accuracy', 0, 100, 'Minimum Accuracy') : Number(r.required_accuracy) || 0;
      out[lang] = rule;
    }
    d.language_rules = out;
  }
  json(d, 'result_components', 'Result components');
  if (d.result_components) {
    d.result_components = Object.fromEntries(RESULT_COMPONENT_KEYS.map((k) => [k, d.result_components[k] !== false]));
  }
  if (d.test_format !== undefined && !['formatting', 'normal'].includes(d.test_format)) throw new BadRequestException('Test format must be formatting or normal.');
  text(d, 'instructions_text', 20000, 'Instructions');
}

export function cleanChapterInfo(d: any) {
  if (!d) return;
  text(d, 'name', 150, 'Test title');
  text(d, 'description', 500, 'Description');
  text(d, 'volume', 60, 'Volume');
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
