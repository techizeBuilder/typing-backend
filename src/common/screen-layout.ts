import { BadRequestException } from '@nestjs/common';

// Admin-designed exam screen ("Screen 7 — Institute Layout"). Stored as JSON in
// the app_settings key `screen_layout`. Only display options live here: the
// typing engine, timer rules and grading are the same for every screen.

export const LAYOUT_POSITIONS = ['Left Top', 'Center Top', 'Right Top', 'Left Bottom', 'Center Bottom', 'Right Bottom'] as const;
const BOOL_GROUPS = {
  header: ['examName', 'mainTitle', 'instruction', 'logo', 'showHideText'],
  buttons: ['fontSize', 'fullScreen', 'pause', 'submit'],
  candidate: ['photo', 'name', 'rollNo'],
} as const;
const COLOR_KEYS = ['headerBg', 'headerText', 'bodyBg', 'passageBg', 'typingBg', 'buttonBg', 'buttonText', 'border', 'submitBg', 'fontBtnBg', 'fontBtnText'] as const;
const HEIGHTS = { header: [40, 140], passage: [100, 400], typing: [100, 400] } as const;
const TEXTS = { topHeaderTitle: 100, mainTitle: 120, subTitle: 200 } as const;
const CHOICES = {
  timerPosition: LAYOUT_POSITIONS,
  buttonPosition: LAYOUT_POSITIONS,
  buttonStyle: ['Modern', 'Classic'],
  keyboardSound: ['Off', 'Click 1', 'Click 2'],
} as const;

const HEX = /^#[0-9a-f]{6}$/i;

// Validates and normalises a layout. Unknown keys are dropped; missing ones are
// left out so the app's defaults apply.
export function sanitizeScreenLayout(raw: string): string {
  if (!raw) return '';
  let input: any;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new BadRequestException('Screen layout must be valid JSON.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Screen layout must be an object.');
  const out: Record<string, any> = {};

  for (const [key, max] of Object.entries(TEXTS)) {
    if (input[key] === undefined) continue;
    const v = String(input[key] ?? '').trim();
    if (v.length > max) throw new BadRequestException(`${key} must be at most ${max} characters.`);
    out[key] = v;
  }
  for (const [group, keys] of Object.entries(BOOL_GROUPS)) {
    if (input[group] === undefined) continue;
    out[group] = {};
    for (const k of keys) {
      if (input[group]?.[k] === undefined) continue;
      if (typeof input[group][k] !== 'boolean') throw new BadRequestException(`${group}.${k} must be true or false.`);
      out[group][k] = input[group][k];
    }
  }
  for (const [key, allowed] of Object.entries(CHOICES)) {
    if (input[key] === undefined) continue;
    if (!(allowed as readonly string[]).includes(input[key])) throw new BadRequestException(`${key} must be one of: ${allowed.join(', ')}.`);
    out[key] = input[key];
  }
  if (input.heights !== undefined) {
    out.heights = {};
    for (const [k, [min, max]] of Object.entries(HEIGHTS)) {
      if (input.heights?.[k] === undefined) continue;
      const n = Number(input.heights[k]);
      if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`heights.${k} must be a whole number from ${min} to ${max}.`);
      out.heights[k] = n;
    }
  }
  if (input.colors !== undefined) {
    out.colors = {};
    for (const k of COLOR_KEYS) {
      if (input.colors?.[k] === undefined) continue;
      if (!HEX.test(String(input.colors[k]))) throw new BadRequestException(`colors.${k} must be a hex colour like #0A2E6B.`);
      out.colors[k] = String(input.colors[k]).toUpperCase();
    }
  }
  return JSON.stringify(out);
}
