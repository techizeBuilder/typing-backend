import { SettingsService } from './settings.service';

const withTime = (value: string | null) => new SettingsService({ findOneBy: async () => (value === null ? null : { value }) } as any);

describe('live rank publish time (India time)', () => {
  it('after 21:00 IST the cut-off is today 21:00 IST', async () => {
    const cut = await withTime('21:00').getLiveRankPublishedCutoff(new Date('2026-11-02T16:00:00Z'));   // 21:30 IST
    expect(cut.toISOString()).toBe('2026-11-02T15:30:00.000Z');
  });
  it('before 21:00 IST it is yesterday 21:00 IST', async () => {
    const cut = await withTime('21:00').getLiveRankPublishedCutoff(new Date('2026-11-02T10:00:00Z'));   // 15:30 IST
    expect(cut.toISOString()).toBe('2026-11-01T15:30:00.000Z');
  });
  it('just after midnight IST belongs to the new India day', async () => {
    const cut = await withTime('00:30').getLiveRankPublishedCutoff(new Date('2026-11-01T19:15:00Z'));   // 00:45 IST on 2 Nov
    expect(cut.toISOString()).toBe('2026-11-01T19:00:00.000Z');
  });
  it('bad or missing time falls back to 21:00', async () => {
    const cut = await withTime('garbage').getLiveRankPublishedCutoff(new Date('2026-11-02T16:00:00Z'));
    expect(cut.toISOString()).toBe('2026-11-02T15:30:00.000Z');
  });
});
