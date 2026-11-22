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
//   penalty_type/_value      words deducted per mistake (Stroke penalties ÷ 5)
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
}) {
  const p = pattern || {};

  // ── Mistakes that count, per the pattern ──────────────────────────────────
  let full = Number(fullErrors) || 0;
  let half = Number(halfErrors) || 0;
  if (steno) {
    if (p.count_omissions_as_errors === false) full = Math.max(0, full - (Number(trailingOmissions) || 0));
    if (p.transposition_mistake === 'full') full += Number(transpositions) || 0;
    else if (p.transposition_mistake === 'half') half += Number(transpositions) || 0;
  }
  const halfWeight = halfWeightOf(p);
  const totalMistakes = round2(full + half * halfWeight);

  // ── Speed base (always reported in words) ─────────────────────────────────
  const minutes = timeElapsed > 0 ? timeElapsed / 60 : 1;
  const strokeMode = speedCountOf(p) === 'Strokes';
  const rightOnly = !!p.count_right_words_only && correctWords !== null && correctWords !== undefined;
  const rawWords = rightOnly
    ? (strokeMode ? (correctStrokes ?? correctWords * 5) / 5 : correctWords)
    : (strokeMode ? (Number(totalStrokes) || 0) / 5 : (Number(typedWords) || 0));
  const totalWords = round2(rawWords);
  const gwpm = round2(totalWords / minutes);

  // ── Penalty ───────────────────────────────────────────────────────────────
  const ignorableEnabled = !!p.ignorable_mistakes_enabled;
  const ignorablePercent = Math.max(0, Math.min(100, Number(p.ignorable_mistakes_percent) || 0));
  const deductionPerMistake = p.ignorable_penalty_words_per_mistake ?? 10;
  const ignorableAllowance = ignorableEnabled ? round2(totalWords * (ignorablePercent / 100)) : 0;
  const excessMistakes = ignorableEnabled ? round2(Math.max(0, totalMistakes - ignorableAllowance)) : 0;
  const penaltyFactor = p.penalty_value ?? 1;
  const penaltyType = p.penalty_type ?? 'Word';
  const penaltyWords = round2(ignorableEnabled
    ? excessMistakes * deductionPerMistake
    : penaltyType === 'Stroke' ? (totalMistakes * penaltyFactor) / 5 : totalMistakes * penaltyFactor);

  const netWords = round2(Math.max(0, totalWords - penaltyWords));
  const nwpm = round2(Math.max(0, netWords / minutes));
  const speedAccuracy = gwpm > 0 ? round2(Math.max(0, Math.min(100, (nwpm / gwpm) * 100))) : 0;

  // ── Steno percentage ──────────────────────────────────────────────────────
  const counted = ignorableEnabled ? excessMistakes : totalMistakes;
  const mistakePercent = steno && originalWords > 0 ? round2(Math.min(100, (counted / originalWords) * 100)) : null;
  const percentBased = mistakePercent !== null;
  const accuracy = percentBased ? round2(100 - mistakePercent) : speedAccuracy;

  // ── Qualification ─────────────────────────────────────────────────────────
  const qualifyOn = p.qualify_on === 'GWPM' ? 'GWPM' : 'NWPM';
  const requiredSpeed = p.required_speed ?? 30;
  const requiredAccuracy = p.required_accuracy ?? 95;
  const speed = qualifyOn === 'GWPM' ? gwpm : nwpm;
  const qualified = percentBased
    ? accuracy >= requiredAccuracy
    : speed >= requiredSpeed && accuracy >= requiredAccuracy;

  return {
    fullErrors: full, halfErrors: half, halfWeight, totalMistakes,
    totalWords, minutes, gwpm,
    ignorableEnabled, ignorablePercent, ignorableAllowance, excessMistakes, deductionPerMistake,
    penaltyFactor, penaltyType, penaltyWords, netWords, nwpm,
    mistakePercent, percentBased, accuracy,
    qualifyOn, requiredSpeed, requiredAccuracy, qualified,
  };
}
