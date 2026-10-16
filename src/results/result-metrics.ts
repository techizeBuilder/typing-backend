// Server-side copy of Electron-desktop/frontend/src/utils/resultMetrics.js, used by
// GET /results/stats so the admin statistics match the results table and the result
// detail screen exactly. The function body is a VERBATIM copy (only TypeScript
// annotations added); an equivalence test compares both copies. Keep them in sync.
/* eslint-disable */
// Canonical result-metric calculation shared by the result detail screen and the
// admin results table.
//
// WHY THIS EXISTS
// The test engines store gwpm/nwpm/accuracy that were computed live from the
// error counts they tracked during the test (finalFull/finalHalf). The result
// DETAIL screen (ResultScreen.jsx), however, RE-DERIVES the error counts from the
// authoritative `word_statuses` array before computing speed — this corrects the
// "detectLineChanges divergence" noted in ResultScreen and is treated as the
// correct value the student/admin sees. As a result the stored nwpm can disagree
// with the detail view for typing results.
//
// This helper reproduces ResultScreen's canonical formula so the admin results
// table renders the SAME (correct) NWPM/GWPM/accuracy as the detail view, for both
// existing and new records, without duplicating the screen's rendering code.
//
// It mirrors the algorithm in ResultScreen.jsx (the error-count loop around
// lines 1231-1314). Keep the two in sync if the grading rules change.

/**
 * @param {object} r A stored result row (snake_case fields as returned by the API).
 * @returns {{ gwpm:number, nwpm:number, accuracy:number, fullErrors:number, halfErrors:number, penaltyWords:number }}
 */
export function computeResultMetrics(r: any): { gwpm: number; nwpm: number; accuracy: number; fullErrors: number; halfErrors: number; penaltyWords: number } {
  const pattern        = r?.pattern_data || null;
  const userInput      = r?.user_input || '';
  const referenceWords = Array.isArray(r?.reference_words) ? r.reference_words : [];
  const wordStatuses   = Array.isArray(r?.word_statuses) ? r.word_statuses : [];
  const totalStrokes   = Number(r?.total_strokes) || 0;
  const timeElapsed    = Number(r?.time_elapsed) > 0 ? Number(r.time_elapsed) : 600;
  // Steno results are graded by the engine's compareTexts() and stored directly;
  // ResultScreen uses the stored full/half counts verbatim for them (no re-derive).
  const isSteno        = (r?.mode || '').toLowerCase().includes('steno');

  // Legacy typing rows that predate per-word grading have no word_statuses to
  // re-derive from. Re-deriving would treat every reference word as an omission
  // and crush the speed to ~0, so trust the engine-stored values instead.
  if (!isSteno && wordStatuses.length === 0) {
    return {
      gwpm: Number(r?.gwpm) || 0,
      nwpm: Number(r?.nwpm) || 0,
      accuracy: Number(r?.accuracy) || 0,
      fullErrors: Number(r?.full_errors) || 0,
      halfErrors: Number(r?.half_errors) || 0,
      penaltyWords: 0,
    };
  }

  const timeMinutes = timeElapsed > 0 ? timeElapsed / 60 : 1;

  // ── Re-derive error counts from word_statuses (typing only) ──────────────────
  const typedWds = userInput.trim().split(/\s+/).filter(Boolean);
  const lastTyped = (() => {
    for (let i = wordStatuses.length - 1; i >= 0; i--) {
      if (wordStatuses[i] && wordStatuses[i] !== 'pending') return i;
    }
    return -1;
  })();

  const extraTypedWords = Array.isArray(pattern?.extra_typed_words) ? pattern.extra_typed_words : null;
  const addCount = extraTypedWords
    ? extraTypedWords.length
    : typedWds.slice(referenceWords.length).length;

  const repeatedRanges = Array.isArray(pattern?.repeated_ranges) ? pattern.repeated_ranges : [];
  const repeatedWordCount = repeatedRanges.reduce(
    (sum: number, rr: any) => sum + ((rr.end ?? 0) - (rr.start ?? 0) + 1), 0,
  );
  const extraSpaceCount = (userInput.match(/ {2,}/g) || []).length;
  const countOmissions = pattern?.count_omissions_as_errors ?? true;

  let sp = 0, om = 0, halfCount = 0;
  if (!isSteno && referenceWords.length > 0) {
    referenceWords.forEach((_: any, i: number) => {
      const s = wordStatuses[i] || 'pending';
      if (s === 'error') sp++;
      else if (s === 'pending') {
        const isTrailing = i > lastTyped;
        if (!isTrailing || countOmissions) om++;
      } else if (s === 'half-error') {
        // Capitalisation vs punctuation both weigh as one half mistake; the split
        // is irrelevant to the totals, so we don't reconstruct word alignment.
        halfCount++;
      }
    });
  }

  // Steno: trust stored counts. Typing: use the re-derived counts.
  const fullErrors = isSteno ? (Number(r?.full_errors) || 0) : (sp + om + addCount + repeatedWordCount);
  const halfErrors = isSteno ? (Number(r?.half_errors) || 0) : (halfCount + extraSpaceCount);

  // ── Speed / penalty (identical to ResultScreen) ──────────────────────────────
  const speedCount   = pattern?.speed_count ?? 'Strokes';
  const isStrokeMode = speedCount === 'Strokes';
  const actualTypedWordCount = typedWds.length;
  const totalWords = isStrokeMode ? totalStrokes / 5 : actualTypedWordCount;
  const grossSpeed = totalWords / timeMinutes;

  const halfMistakeEnabled = pattern?.half_mistake_enabled ?? true;
  const halfMultiplier = halfMistakeEnabled ? 0.5 : 1;
  const totalMistakes = fullErrors + halfErrors * halfMultiplier;

  const penaltyFactor = pattern?.penalty_value ?? 1;
  const penaltyType   = pattern?.penalty_type ?? 'Word';

  const ignorableEnabled = pattern?.ignorable_mistakes_enabled ?? false;
  const ignorablePercent = Math.max(0, Math.min(100, pattern?.ignorable_mistakes_percent ?? 0));
  const deductionPerMistake = pattern?.ignorable_penalty_words_per_mistake ?? 10;
  const ignorableAllowance = ignorableEnabled ? totalWords * (ignorablePercent / 100) : 0;
  const excessMistakes = ignorableEnabled ? Math.max(0, totalMistakes - ignorableAllowance) : 0;

  // Net & gross speed are always in words; a stroke-denominated penalty converts ÷5.
  const penaltyConverted = penaltyType === 'Stroke'
    ? totalMistakes * penaltyFactor / 5
    : totalMistakes * penaltyFactor;
  const penaltyWords = ignorableEnabled
    ? excessMistakes * deductionPerMistake
    : penaltyConverted;

  const netWords  = Math.max(0, totalWords - penaltyWords);
  const grossSpeedCalculated = Math.max(0, grossSpeed);
  const netSpeedCalculated   = Math.max(0, netWords / timeMinutes);
  const accuracy = grossSpeedCalculated > 0
    ? Math.max(0, Math.min(100, (netSpeedCalculated / grossSpeedCalculated) * 100))
    : 0;

  const round2 = (n: number) => parseFloat(n.toFixed(2));
  return {
    gwpm: round2(grossSpeedCalculated),
    nwpm: round2(netSpeedCalculated),
    accuracy: round2(accuracy),
    fullErrors,
    halfErrors,
    penaltyWords: round2(penaltyWords),
  };
}
