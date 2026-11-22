import { BadRequestException } from '@nestjs/common';
import { cleanScoring, ResultPatternsService } from './result-patterns.service';

const valid = () => ({ name: 'SSC', speed_count: 'Words', qualify_on: 'NWPM', penalty_type: 'Word', penalty_value: 1, required_speed: 35, required_accuracy: 95 });

describe('result pattern scoring settings', () => {
  it('accepts a normal pattern and coerces numbers and flags', () => {
    const d: any = { ...valid(), required_speed: '35', half_mistake_enabled: 'true', show_accuracy: 'false', transposition_mistake: 'half' };
    cleanScoring(d, false);
    expect(d).toMatchObject({ required_speed: 35, half_mistake_enabled: true, show_accuracy: false, transposition_mistake: 'half' });
  });

  it.each([
    ['speed_count', 'Letters'], ['qualify_on', 'CPM'], ['penalty_type', 'Line'], ['transposition_mistake', 'twice'],
    ['penalty_value', -1], ['penalty_value', 'abc'], ['required_accuracy', 101], ['required_speed', -5],
    ['ignorable_mistakes_percent', 150], ['ignorable_penalty_words_per_mistake', -2], ['required_speed', ''],
  ])('rejects %s = %p', (k, v) => {
    expect(() => cleanScoring({ ...valid(), [k]: v }, false)).toThrow(BadRequestException);
  });

  it('requires a name when creating, not on a partial update', () => {
    expect(() => cleanScoring({ ...valid(), name: '  ' }, false)).toThrow(BadRequestException);
    expect(() => cleanScoring({ penalty_value: 2 }, true)).not.toThrow();
  });

  it('service drops unknown fields instead of failing with a 500', async () => {
    const saved: any[] = [];
    const repo: any = {
      metadata: { columns: ['id', 'name', 'speed_count', 'qualify_on', 'penalty_type', 'penalty_value', 'required_speed', 'required_accuracy', 'is_default', 'applicable_typing', 'applicable_steno'].map((propertyName) => ({ propertyName })) },
      create: (d: any) => d,
      save: async (d: any) => { saved.push(d); return { id: 'p1', ...d }; },
    };
    const svc = new ResultPatternsService(repo);
    await svc.create({ ...valid(), not_a_column: 1 } as any);
    expect(saved[0].not_a_column).toBeUndefined();
    expect(saved[0].name).toBe('SSC');
  });
});
