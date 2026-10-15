import { BadRequestException } from '@nestjs/common';

// Allowed values for the student-facing exam extras.
export const EXAM_REGIONS = ['Delhi', 'UP', 'MP', 'Rajasthan', 'Haryana', 'Bihar', 'Other State'] as const;
export const CHAPTER_DIFFICULTIES = ['Easy', 'Moderate', 'Hard'] as const;

// '' / null → null (not set); otherwise must be one of `allowed`. Leaves the field
// untouched when it was not sent, so partial updates keep the stored value.
export function normalizeChoice(data: Record<string, any>, field: string, allowed: readonly string[]): void {
  if (!data || !(field in data)) return;
  const value = data[field];
  if (value === null || value === undefined || String(value).trim() === '') {
    data[field] = null;
    return;
  }
  if (!allowed.includes(String(value))) {
    throw new BadRequestException(`Invalid ${field}: ${value}. Allowed: ${allowed.join(', ')}.`);
  }
  data[field] = String(value);
}
