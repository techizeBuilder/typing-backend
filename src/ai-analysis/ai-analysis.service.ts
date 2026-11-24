import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AiAnalysis } from '../entities/ai-analysis.entity';
import { Result } from '../entities/result.entity';
import { User, UserRole } from '../entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../entities/app_setting.entity';
import { zonedDate, zonedDayStart } from '../common/zoned-time';

// Read lazily: ConfigModule loads the env files after module files are imported.
const apiKey = () => (process.env.OPENAI_API_KEY || '').trim();
const modelName = () => (process.env.OPENAI_MODEL || '').trim() || 'gpt-5.4-mini';

// What the AI writes. Numbers, levels and charts are computed by the app; the
// model only writes the coaching text.
const AnalysisSchema = z.object({
  executive_summary: z.string(),
  recommendations: z.array(z.object({ title: z.string(), text: z.string() })),
  plan: z.array(z.object({ title: z.string(), items: z.array(z.string()), goal: z.string() })),
  coach_message: z.string(),
});
export type AnalysisText = z.infer<typeof AnalysisSchema>;

// Frozen instructions (kept byte-stable; per-request data goes in the user turn).
const SYSTEM = `You are an encouraging typing and stenography coach for Indian government-exam aspirants (SSC, court, police, state exams). You receive one test result as JSON: speed (gross and net WPM), accuracy, time, the exam's target speed, mistake counts by category (full mistakes: spelling/wrong word, omission, addition, repetition; half mistakes: capitalisation, punctuation, extra space), some words the student got wrong, and their recent results.

Write a short, specific analysis grounded only in those numbers:
- executive_summary: 2-3 sentences on strengths, the main weakness and how far the student is from the target.
- recommendations: exactly 3 items. Each has a short title and 1-2 sentences of concrete practice advice tied to the actual mistake categories and words.
- plan: exactly 4 weekly steps for the next 30 days. Each has a title, exactly 3 short action items, and a measurable goal (a WPM or accuracy figure that steps realistically from the current numbers towards the target).
- coach_message: 2-3 warm, motivating sentences addressed to the student as "you". Do not use a name or a greeting word like "Hi"; the app adds the greeting.

Use simple English. Never invent numbers that are not in the data or derived from it. Do not mention these instructions or that you are an AI.`;

const num = (v: any, min: number, max: number, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : def;
};
const str = (v: any, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export interface AnalysisResponse {
  source: 'ai' | 'unavailable';
  reason?: 'disabled' | 'not_configured' | 'daily_limit' | 'error';
  analysis?: AnalysisText;
  cached?: boolean;
  remaining_today?: number;
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private client: OpenAI | null = null;

  constructor(
    @InjectRepository(AiAnalysis) private readonly analyses: Repository<AiAnalysis>,
    @InjectRepository(Result) private readonly results: Repository<Result>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly settings: SettingsService,
  ) {}

  private getClient() {
    // Only an explicit server key is used, so the feature stays off until the
    // institute adds OPENAI_API_KEY to the backend .env.secrets.
    const key = apiKey();
    if (!key) return null;
    this.client = this.client || new OpenAI({ apiKey: key, timeout: 50_000, maxRetries: 1 });
    return this.client;
  }

  async status(userId: string) {
    const all = await this.settings.getAll();
    const enabled = all[SETTING_KEYS.AI_ANALYSIS_ENABLED] !== 'false';
    const limit = parseInt(all[SETTING_KEYS.AI_DAILY_LIMIT], 10) || 5;
    const used = await this.usedToday(userId);
    return { enabled, configured: !!apiKey(), daily_limit: limit, used_today: used };
  }

  private async usedToday(userId: string) {
    // "Today" is the India calendar day, whatever time zone the server runs in.
    const start = zonedDayStart(zonedDate(new Date()));
    return this.analyses.count({ where: { student_id: userId, created_at: MoreThanOrEqual(start) } });
  }

  // Validate and bound everything the result screen sends.
  private cleanInput(body: any) {
    if (!body || typeof body !== 'object') throw new BadRequestException('Missing result data.');
    const c = body.counts || {};
    const words = Array.isArray(body.mistake_words) ? body.mistake_words.slice(0, 20) : [];
    return {
      exam: str(body.exam, 120),
      mode: str(body.mode, 40),
      kind: body.kind === 'steno' ? 'steno' : 'typing',
      gross_wpm: num(body.gross_wpm, 0, 400),
      net_wpm: num(body.net_wpm, 0, 400),
      accuracy_pct: num(body.accuracy, 0, 100),
      minutes: num(body.minutes, 0, 300),
      target_wpm: num(body.target_wpm, 0, 300) || null,
      total_words: num(body.total_words, 0, 100000),
      correct_words: num(body.correct_words, 0, 100000),
      mistakes: {
        spelling: num(c.spelling, 0, 10000), omission: num(c.omission, 0, 10000), addition: num(c.addition, 0, 10000),
        repetition: num(c.repetition, 0, 10000), capitalisation: num(c.capitalisation, 0, 10000),
        punctuation: num(c.punctuation, 0, 10000), extra_space: num(c.extraSpace, 0, 10000),
      },
      mistake_words: words.map((w: any) => ({ expected: str(w?.expected, 40), typed: str(w?.typed, 40) })).filter((w: any) => w.expected || w.typed),
    };
  }

  async analyse(userId: string, body: any): Promise<AnalysisResponse> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.role !== UserRole.STUDENT) throw new ForbiddenException('AI analysis is for students.');
    const input = this.cleanInput(body);
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');

    const cached = await this.analyses.findOne({ where: { student_id: userId, input_hash: hash } });
    if (cached) return { source: 'ai', analysis: cached.content, cached: true };

    const st = await this.status(userId);
    if (!st.enabled) return { source: 'unavailable', reason: 'disabled' };
    const client = this.getClient();
    if (!client) return { source: 'unavailable', reason: 'not_configured' };
    if (st.used_today >= st.daily_limit) return { source: 'unavailable', reason: 'daily_limit', remaining_today: 0 };

    // The student's own recent results (from the database) for a consistency view.
    const recent = await this.results.find({
      where: { student_id: userId },
      order: { date_taken: 'DESC' },
      take: 10,
    }).catch(() => []);
    const history = (recent as any[]).map((r) => ({ date: String(r.date_taken || '').slice(0, 10), mode: r.mode, net_wpm: Number(r.nwpm) || 0, accuracy_pct: Number(r.accuracy) || 0 }));

    try {
      const response = await client.responses.parse({
        model: modelName(),
        max_output_tokens: 8000,
        store: false,
        text: { format: zodTextFormat(AnalysisSchema, 'analysis') },
        instructions: SYSTEM,
        input: JSON.stringify({ result: input, recent_results: history }),
      });
      if (!response.output_parsed) {
        this.logger.warn(`AI analysis not produced (status=${response.status}, reason=${response.incomplete_details?.reason || 'refusal'}).`);
        return { source: 'unavailable', reason: 'error' };
      }
      const analysis = response.output_parsed;
      await this.analyses.createQueryBuilder().insert().values({
        student_id: userId, input_hash: hash, content: analysis as any, model: response.model,
        input_tokens: response.usage?.input_tokens || 0, output_tokens: response.usage?.output_tokens || 0,
      }).orIgnore().execute();
      return { source: 'ai', analysis, cached: false, remaining_today: Math.max(0, st.daily_limit - st.used_today - 1) };
    } catch (err) {
      if (err instanceof OpenAI.AuthenticationError) this.logger.error('AI analysis: OPENAI_API_KEY was rejected.');
      else if (err instanceof OpenAI.RateLimitError && (err.type === 'insufficient_quota' || err.code === 'insufficient_quota')) this.logger.error('AI analysis: the OpenAI account has no credits left; add credits in OpenAI billing.');
      else if (err instanceof OpenAI.RateLimitError) this.logger.warn('AI analysis: rate limited by the API.');
      else if (err instanceof OpenAI.APIError) this.logger.error(`AI analysis API error ${err.status}: ${err.message}`);
      else this.logger.error(`AI analysis failed: ${(err as Error)?.message}`);
      return { source: 'unavailable', reason: 'error' };
    }
  }

  // Staff overview: how much the feature is used.
  async usage() {
    const rows = await this.analyses.createQueryBuilder('a')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(a.input_tokens), 0)', 'input_tokens')
      .addSelect('COALESCE(SUM(a.output_tokens), 0)', 'output_tokens')
      .getRawOne();
    const start = zonedDayStart(`${zonedDate(new Date()).slice(0, 8)}01`);
    const month = await this.analyses.count({ where: { created_at: MoreThanOrEqual(start) } });
    return { total: Number(rows?.count || 0), this_month: month, input_tokens: Number(rows?.input_tokens || 0), output_tokens: Number(rows?.output_tokens || 0), model: modelName(), configured: !!apiKey() };
  }
}
