import { BadRequestException } from '@nestjs/common';
import { cleanExamInfo, RESULT_COMPONENT_KEYS } from './management-fields';
import { sanitizeScreenLayout } from './screen-layout';
import { cleanScoring } from '../result-patterns/result-patterns.service';

const rule = { enabled: true, qualify_on: 'NWPM', required_speed: 35, required_accuracy: 90, min: 0, max: 0 };
const clean = (language_rules: any) => { const d: any = { language_rules: JSON.stringify(language_rules) }; cleanExamInfo(d); return d.language_rules; };

describe('exam rules', () => {
  it('parses language rules and the 17 components from a multipart form', () => {
    expect(clean({ english: rule, french: rule })).toEqual({ english: rule });
    const d: any = { result_components: JSON.stringify({ show_rank: false, hack: true }), instructions_text: '', test_format: 'normal' };
    cleanExamInfo(d);
    expect(Object.keys(d.result_components)).toEqual(RESULT_COMPONENT_KEYS);
    expect([d.result_components.show_rank, d.result_components.show_marks, d.instructions_text]).toEqual([false, true, null]);
    expect(RESULT_COMPONENT_KEYS.length).toBe(17);
  });
  it.each([{ required_accuracy: 101 }, { required_speed: '' }, { min: 50, max: 40 }, { qualify_on: 'X' }, { min: -1 }, { max: 1.5 }])('rejects %p', (o) => {
    expect(() => clean({ hindi: { ...rule, ...o } })).toThrow(BadRequestException);
  });
  it('rejects broken JSON, format and long instructions; leaves partial updates alone', () => {
    expect(() => cleanExamInfo({ language_rules: '{x' })).toThrow(BadRequestException);
    expect(() => cleanExamInfo({ test_format: 'fancy' })).toThrow(BadRequestException);
    expect(() => cleanExamInfo({ instructions_text: 'a'.repeat(20001) })).toThrow(BadRequestException);
    const d: any = { is_active: 'true' }; cleanExamInfo(d); expect(d).toEqual({ is_active: true });
  });
});

describe('pattern calculation settings', () => {
  it.each([
    { speed_unit: 'CPM' }, { accuracy_on: 'x' }, { strokes_per_word: 0 }, { half_mistake_weight: -1 }, { words_penalty: 'a' }, { required_speed: 8000 },
    { marks_ranges: [{ from: 35, to: 31, marks: 1 }] }, { marks_ranges: [{ from: 1, to: 5, marks: 1 }, { from: 5, to: 9, marks: 1 }] }, { marks_ranges: [{ from: 1, to: 5 }] },
  ])('rejects %p', (o) => { expect(() => cleanScoring({ ...o }, true)).toThrow(BadRequestException); });
  it('accepts KDPH speeds, nulls and sorted ranges', () => {
    const d: any = { speed_unit: 'KDPH', required_speed: 8000, half_mistake_weight: null, marks_ranges: [{ from: 36, to: 40, marks: '15' }, { from: 31, to: 35, marks: 12 }] };
    cleanScoring(d, true);
    expect(d.marks_ranges).toEqual([{ from: 31, to: 35, marks: 12 }, { from: 36, to: 40, marks: 15 }]);
  });
});

it('layout heights are 10 to 250 points', () => {
  const save = (header: number) => JSON.parse(sanitizeScreenLayout(JSON.stringify({ heights: { header } })));
  expect(save(10)).toEqual({ heights: { header: 10 }, heightUnit: 'pt' });
  expect(save(250).heights.header).toBe(250);
  expect(() => save(9)).toThrow(BadRequestException);
  expect(() => save(251)).toThrow(BadRequestException);
});
