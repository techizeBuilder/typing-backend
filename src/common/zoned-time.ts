// Wall-clock helpers for a named time zone. The institute works on India time,
// while the server may run in UTC, so "9:00 PM" and "today" must be worked out
// in the right zone rather than with the server's local clock.

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// { date: 'YYYY-MM-DD', minutes: minutes since midnight } for `now` in `tz`.
export function zonedNow(now: Date = new Date(), tz: string = DEFAULT_TIME_ZONE): { date: string; minutes: number } {
  const zone = tz && isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export const toMinutes = (hhmm: string): number => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

// True when `minutes` falls inside [start, end]; windows that cross midnight
// (e.g. 22:00–02:00) are supported.
export function inWindow(minutes: number, start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return s <= e ? minutes >= s && minutes <= e : minutes >= s || minutes <= e;
}

const pad = (n: number) => String(n).padStart(2, '0');

// The instant at which the wall clock in `tz` shows `date` (YYYY-MM-DD) plus
// `minutes` after midnight. Works whatever time zone the server itself runs in.
export function zonedToUtc(date: string, minutes: number, tz: string = DEFAULT_TIME_ZONE): Date {
  const [y, mo, d] = String(date).slice(0, 10).split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, 0, minutes);
  const wall = zonedNow(new Date(guess), tz);
  const [wy, wmo, wd] = wall.date.split('-').map(Number);
  const offset = Date.UTC(wy, wmo - 1, wd, 0, wall.minutes) - guess;
  return new Date(guess - offset);
}

// First and last millisecond of a calendar day in `tz`.
export const zonedDayStart = (date: string, tz: string = DEFAULT_TIME_ZONE): Date => zonedToUtc(date, 0, tz);
export const zonedDayEnd = (date: string, tz: string = DEFAULT_TIME_ZONE): Date => new Date(zonedToUtc(addDays(date, 1), 0, tz).getTime() - 1);

// YYYY-MM-DD `n` days after `date` (calendar arithmetic, no time zone involved).
export function addDays(date: string, n: number): string {
  const [y, mo, d] = String(date).slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// Calendar date of an instant in `tz`.
export const zonedDate = (at: Date | string, tz: string = DEFAULT_TIME_ZONE): string => zonedNow(new Date(at), tz).date;

// A YYYY-MM-DD column value (string, or Date when set in code) as a date string.
export const dateOnly = (v: Date | string): string => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10));

// True once a validity end date is in the past, India time: the student keeps
// access for the whole of the end date.
export function validityEnded(validityEnd: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!validityEnd) return false;
  return zonedNow(now).date > dateOnly(validityEnd);
}
