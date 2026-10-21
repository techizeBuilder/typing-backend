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
