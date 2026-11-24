// GENERATED from Electron-desktop/frontend/src/utils/scoring.js by scripts/sync-scoring.cjs.
// Do not edit here: edit the frontend file and run the script.
// @ts-nocheck
/* eslint-disable */
// The one scoring formula. Every place that turns mistake counts into speed,
// accuracy and Qualified / Not Qualified calls this: both test engines (the values
// they save), the result page, the results lists (resultMetrics.js) and, through a
// verbatim copy in backend/src/results/scoring.ts, the server's stats and ranks.
// Every number follows the exam's Result Pattern set by the admin:
//
//   speed_count              Words → words typed; Strokes → keystrokes ÷ 5
//   count_right_words_only   speed counts only correctly typed words
//   half_mistake_enabled     Yes → a half mistake weighs 0.5; No → it weighs 1
//   strokes_per_word         keystrokes that make one word (default 5)
//   speed_unit               WPM or KDPH: the unit the qualifying speed is set in
//   *_penalty_enabled/value  per mistake: words, strokes (÷ strokes per word) and/or
//                            WPM deducted. Patterns saved before these existed use
//                            penalty_type/_value (one words or strokes penalty)
//   *_weight                 how much each kind of mistake counts (unset: full 1,
//                            half per half_mistake_enabled, extra/missing 1)
//   mistakes_multiply        counted mistakes × this
//   accuracy_on              typing accuracy base (unset: net ÷ gross speed)
//   marks_*                  marks for right words and for the net speed range
//   ignorable_mistakes_*     mistakes up to x% of words typed are free; each one
//                            beyond deducts N words
//   count_omissions_as_errors  No → words left untyped at the end are not mistakes
//   transposition_mistake    steno: swapped words count as none / half / full
//   qualify_on, required_speed, required_accuracy
//
// Typing qualifies on speed (NWPM or GWPM) plus accuracy (net ÷ gross × 100).
// Steno is percentage based: % of mistakes = counted mistakes ÷ original words,
// accuracy = 100 − that %, and only accuracy decides Qualified.
//
// Values are rounded to 2 decimals at each step, exactly as the result page shows
// its working ("[18 words / 0.55 min]"), so every screen shows the same figures.

export const round2 = (n) => parseFloat(Number(n).toFixed(2));

export const halfWeightOf = (pattern) => ((pattern?.half_mistake_enabled ?? true) ? 0.5 : 1);
const weightOr = (v, fallback) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v));
export const strokesPerWordOf = (pattern) => (Number(pattern?.strokes_per_word) > 0 ? Number(pattern.strokes_per_word) : 5);
export const speedUnitOf = (pattern) => (pattern?.speed_unit === 'KDPH' ? 'KDPH' : 'WPM');
export function mistakeWeights(pattern) {
  const half = weightOr(pattern?.half_mistake_weight, halfWeightOf(pattern));
  return {
    full: weightOr(pattern?.full_mistake_weight, 1),
    half,
    extra: weightOr(pattern?.extra_word_weight, 1),
    missing: weightOr(pattern?.missing_word_weight, 1),
    space: weightOr(pattern?.extra_space_weight, half),
    punctuation: weightOr(pattern?.punctuation_weight, half),
  };
}
// Which per-mistake penalties apply, whatever form the pattern was saved in.
export function mistakePenalties(pattern) {
  const p = pattern || {};
  const on = [p.words_penalty_enabled, p.strokes_penalty_enabled, p.speed_penalty_enabled];
  if (on.every((v) => v === null || v === undefined)) {
    const value = p.penalty_value ?? 1;
    return p.penalty_type === 'Stroke' ? { words: 0, strokes: value, speed: 0 } : { words: value, strokes: 0, speed: 0 };
  }
  return {
    words: on[0] ? weightOr(p.words_penalty, 1) : 0,
    strokes: on[1] ? weightOr(p.strokes_penalty, 1) : 0,
    speed: on[2] ? weightOr(p.speed_penalty, 1) : 0,
  };
}
export function penaltyLabel(pattern) {
  const m = mistakePenalties(pattern);
  const parts = [m.words && `${m.words} Word${m.words === 1 ? '' : 's'}`, m.strokes && `${m.strokes} Stroke${m.strokes === 1 ? '' : 's'}`, m.speed && `${m.speed} WPM`].filter(Boolean);
  return parts.join(' + ') || 'No penalty';
}
const ACCURACY_BASES = ['typed_words', 'total_words', 'typed_strokes', 'total_strokes'];

export const speedCountOf = (pattern) => (pattern?.speed_count === 'Words' ? 'Words' : 'Strokes');
export const TRANSPOSITION_RULES = ['none', 'half', 'full'];

export function scoreResult({
  pattern = null,
  steno = false,
  fullErrors = 0,
  halfErrors = 0,
  totalStrokes = 0,
  typedWords = 0,
  correctWords = null,
  correctStrokes = null,
  timeElapsed = 0,
  originalWords = 0,
  transpositions = 0,
  trailingOmissions = 0,
  // Kinds inside the full / half counts, for patterns that weigh them differently.
  extraWords = 0,        // full: added or repeated words
  missingWords = 0,      // full: omitted words
  extraSpaces = 0,       // half
  punctuation = 0,       // half
  uncountedWords = 0,    // left untyped at the end and not counted as mistakes
  testStrokes = 0,       // keystrokes in the whole passage
}) {
  const p = pattern || {};

  // ── Mistakes that count, per the pattern ──────────────────────────────────
  let full = Number(fullErrors) || 0;
  let half = Number(halfErrors) || 0;
  if (steno) {
    if (p.count_omissions_as_errors === false) {
      const left = Number(trailingOmissions) || 0;
      full = Math.max(0, full - left);
      missingWords = Math.max(0, missingWords - left);
    }
    if (p.transposition_mistake === 'full') full += Number(transpositions) || 0;
    else if (p.transposition_mistake === 'half') half += Number(transpositions) || 0;
  }
  const weights = mistakeWeights(p);
  const halfWeight = weights.half;
  const plainFull = Math.max(0, full - extraWords - missingWords);
  const plainHalf = Math.max(0, half - extraSpaces - punctuation);
  const totalMistakes = round2(plainFull * weights.full + extraWords * weights.extra + missingWords * weights.missing
    + plainHalf * weights.half + extraSpaces * weights.space + punctuation * weights.punctuation);

  // ── Speed base (always reported in words) ─────────────────────────────────
  const minutes = timeElapsed > 0 ? timeElapsed / 60 : 1;
  const strokesPerWord = strokesPerWordOf(p);
  const strokeMode = speedCountOf(p) === 'Strokes';
  const rightOnly = !!p.count_right_words_only && correctWords !== null && correctWords !== undefined;
  const rawWords = rightOnly
    ? (strokeMode ? (correctStrokes ?? correctWords * strokesPerWord) / strokesPerWord : correctWords)
    : (strokeMode ? (Number(totalStrokes) || 0) / strokesPerWord : (Number(typedWords) || 0));
  const totalWords = round2(rawWords);
  const gwpm = round2(totalWords / minutes);

  // ── Penalty ───────────────────────────────────────────────────────────────
  const ignorableEnabled = !!p.ignorable_mistakes_enabled;
  const ignorablePercent = Math.max(0, Math.min(100, Number(p.ignorable_mistakes_percent) || 0));
  const deductionPerMistake = p.ignorable_penalty_words_per_mistake ?? 10;
  const ignorableAllowance = ignorableEnabled ? round2(totalWords * (ignorablePercent / 100)) : 0;
  const excessMistakes = ignorableEnabled ? round2(Math.max(0, totalMistakes - ignorableAllowance)) : 0;
  const multiply = weightOr(p.mistakes_multiply, 1);
  const counted = round2((ignorableEnabled ? excessMistakes : totalMistakes) * multiply);
  const penalties = mistakePenalties(p);
  const penaltyFactor = p.penalty_value ?? 1;
  const penaltyType = p.penalty_type ?? 'Word';
  const penaltyWords = round2(ignorableEnabled
    ? counted * deductionPerMistake
    : counted * penalties.words + (counted * penalties.strokes) / strokesPerWord);
  const speedPenalty = round2(counted * penalties.speed);
  const times = `${ignorableEnabled ? `${excessMistakes} excess mistakes` : `${totalMistakes} mistakes`}${multiply !== 1 ? ` × ${multiply}` : ''}`;
  const penaltyFormula = (ignorableEnabled
    ? [`${times} × ${deductionPerMistake} words`]
    : [penalties.words && `${times} × ${penalties.words} words`, penalties.strokes && `${times} × ${penalties.strokes} strokes ÷ ${strokesPerWord}`].filter(Boolean)
  ).join(' + ') || 'no words penalty';

  const netWords = round2(Math.max(0, totalWords - penaltyWords));
  const nwpm = round2(Math.max(0, netWords / minutes - speedPenalty));
  const speedAccuracy = gwpm > 0 ? round2(Math.max(0, Math.min(100, (nwpm / gwpm) * 100))) : 0;

  // ── Steno percentage ──────────────────────────────────────────────────────
  const mistakePercent = steno && originalWords > 0 ? round2(Math.min(100, (counted / originalWords) * 100)) : null;
  const percentBased = mistakePercent !== null;
  const accuracyOn = ACCURACY_BASES.includes(p.accuracy_on) ? p.accuracy_on : 'speed';
  const typedCount = Number(typedWords) || 0;
  const typedKeys = Number(totalStrokes) || 0;
  const [accuracyBase, notRight] = {
    typed_words: [typedCount, counted],
    total_words: [originalWords, counted + uncountedWords],
    typed_strokes: [typedKeys, counted * strokesPerWord],
    total_strokes: [testStrokes, (counted + uncountedWords) * strokesPerWord],
  }[accuracyOn] || [0, 0];
  const typingAccuracy = accuracyOn === 'speed' ? speedAccuracy
    : accuracyBase > 0 && typedCount > 0 ? round2(Math.max(0, Math.min(100, ((accuracyBase - notRight) / accuracyBase) * 100))) : 0;
  const accuracy = percentBased ? round2(100 - mistakePercent) : typingAccuracy;

  // ── KDPH and marks ────────────────────────────────────────────────────────
  const speedUnit = speedUnitOf(p);
  const grossKdph = Math.round((totalWords * strokesPerWord * 60) / minutes);
  const netKdph = Math.round(nwpm * strokesPerWord * 60);
  let marks = null;
  if (p.marks_right_words_enabled) marks = (Number(correctWords) || 0) * weightOr(p.marks_per_right_word, 0);
  if (p.marks_net_wpm_enabled) {
    // Whole-number ranges ("31 - 35", "36 - 40"): 35.6 still belongs to 31 - 35.
    const speedNow = Math.floor(nwpm);
    const hit = (Array.isArray(p.marks_ranges) ? p.marks_ranges : []).find((r) => speedNow >= Number(r.from) && speedNow <= Number(r.to));
    marks = (marks || 0) + (hit ? Number(hit.marks) || 0 : 0);
  }
  if (marks !== null) marks = round2(marks);

  // ── Qualification ─────────────────────────────────────────────────────────
  const qualifyOn = p.qualify_on === 'GWPM' ? 'GWPM' : 'NWPM';
  const requiredSpeed = p.required_speed ?? 30;
  const requiredAccuracy = p.required_accuracy ?? 95;
  const speed = speedUnit === 'KDPH' ? (qualifyOn === 'GWPM' ? grossKdph : netKdph) : (qualifyOn === 'GWPM' ? gwpm : nwpm);
  const qualified = percentBased
    ? accuracy >= requiredAccuracy
    : speed >= requiredSpeed && accuracy >= requiredAccuracy;

  return {
    fullErrors: full, halfErrors: half, halfWeight, totalMistakes,
    totalWords, minutes, gwpm,
    ignorableEnabled, ignorablePercent, ignorableAllowance, excessMistakes, deductionPerMistake,
    penaltyFactor, penaltyType, penaltyWords, netWords, nwpm,
    mistakePercent, percentBased, accuracy,
    weights, strokesPerWord, multiply, penalties, penaltyFormula, speedPenalty, accuracyOn,
    speedUnit, grossKdph, netKdph, marks, speedToCheck: speed,
    qualifyOn, requiredSpeed, requiredAccuracy, qualified,
  };
}
