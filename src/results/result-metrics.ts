// GENERATED from Electron-desktop/frontend/src/utils/resultMetrics.js by scripts/sync-scoring.cjs.
// Do not edit here: edit the frontend file and run the script.
// @ts-nocheck
/* eslint-disable */
// Scores a stored result row exactly as the result page does. Used by every list
// (student and admin results, leaderboards, dashboards) so a result shows the same
// speed, accuracy and verdict everywhere. backend/src/results/result-metrics.ts is a
// verbatim copy used by the server's statistics and ranks; keep the two in sync.
//
// Typing: the engine-stored mistake counts can drift from the word-by-word grading
// (line-change detection), so the counts are re-derived from `word_statuses`.
// Steno: the engine's stored full/half counts are used, plus the extra facts it
// saves in pattern_data (transpositions, trailing omissions, correct words).
import { scoreResult } from './scoring';

/**
 * @param {object} r A stored result row (snake_case fields as returned by the API).
 */
export function computeResultMetrics(r) {
  const pattern        = r?.pattern_data || null;
  const userInput      = r?.user_input || '';
  const referenceWords = Array.isArray(r?.reference_words) ? r.reference_words : [];
  const wordStatuses   = Array.isArray(r?.word_statuses) ? r.word_statuses : [];
  const totalStrokes   = Number(r?.total_strokes) || 0;
  const timeElapsed    = Number(r?.time_elapsed) > 0 ? Number(r.time_elapsed) : 600;
  const isSteno        = (r?.mode || '').toLowerCase().includes('steno');
  const typedWds       = userInput.trim().split(/\s+/).filter(Boolean);

  // Legacy typing rows that predate per-word grading have no word_statuses to
  // re-derive from. Re-deriving would treat every reference word as an omission
  // and crush the speed to ~0, so trust the engine-stored values instead.
  if (!isSteno && wordStatuses.length === 0) {
    const gwpm = Number(r?.gwpm) || 0;
    const nwpm = Number(r?.nwpm) || 0;
    const accuracy = Number(r?.accuracy) || 0;
    const speed = pattern?.qualify_on === 'GWPM' ? gwpm : nwpm;
    return {
      gwpm, nwpm, accuracy,
      fullErrors: Number(r?.full_errors) || 0,
      halfErrors: Number(r?.half_errors) || 0,
      penaltyWords: 0,
      qualified: speed >= (pattern?.required_speed ?? 30) && accuracy >= (pattern?.required_accuracy ?? 95),
      mistakePercent: null,
      percentBased: false,
    };
  }

  let s;
  if (isSteno) {
    s = scoreResult({
      pattern,
      steno: true,
      fullErrors: Number(r?.full_errors) || 0,
      halfErrors: Number(r?.half_errors) || 0,
      totalStrokes,
      typedWords: typedWds.length,
      correctWords: pattern?.correct_words ?? null,
      correctStrokes: pattern?.correct_strokes ?? null,
      timeElapsed,
      originalWords: referenceWords.filter(Boolean).length,
      transpositions: Number(pattern?.transpositions) || 0,
      trailingOmissions: Number(pattern?.trailing_omissions) || 0,
    });
  } else {
    const c = typingMistakeCounts({ referenceWords, wordStatuses, userInput, pattern });
    s = scoreResult({
      pattern,
      fullErrors: c.fullErrors,
      halfErrors: c.halfErrors,
      totalStrokes,
      typedWords: typedWds.length,
      correctWords: c.correctWords,
      correctStrokes: c.correctStrokes,
      timeElapsed,
    });
  }

  return {
    gwpm: s.gwpm,
    nwpm: s.nwpm,
    accuracy: s.accuracy,
    fullErrors: s.fullErrors,
    halfErrors: s.halfErrors,
    penaltyWords: s.penaltyWords,
    qualified: s.qualified,
    mistakePercent: s.mistakePercent,
    percentBased: s.percentBased,
  };
}

// Typing mistake counts from the word-by-word grading, by the result page's rules:
// full = spelling/wrong word + omission + addition + repetition; half = capital /
// punctuation + extra spaces. Words left untyped at the end are omissions only
// when the pattern's "Count Omitted / Left Words as Error" is Yes.
export function typingMistakeCounts({ referenceWords, wordStatuses, userInput = '', pattern }) {
  const typedWds = userInput.trim().split(/\s+/).filter(Boolean);
  let lastTyped = -1;
  for (let i = wordStatuses.length - 1; i >= 0; i--) {
    if (wordStatuses[i] && wordStatuses[i] !== 'pending') { lastTyped = i; break; }
  }
  const extraTypedWords = Array.isArray(pattern?.extra_typed_words) ? pattern.extra_typed_words : null;
  const addCount = extraTypedWords ? extraTypedWords.length : typedWds.slice(referenceWords.length).length;
  const repeatedRanges = Array.isArray(pattern?.repeated_ranges) ? pattern.repeated_ranges : [];
  const repeatedWordCount = repeatedRanges.reduce((sum, rr) => sum + ((rr.end ?? 0) - (rr.start ?? 0) + 1), 0);
  const extraSpaceCount = (userInput.match(/ {2,}/g) || []).length;
  const countOmissions = pattern?.count_omissions_as_errors ?? true;

  let spelling = 0, omissions = 0, halfCount = 0, correctWords = 0, correctStrokes = 0;
  referenceWords.forEach((word, i) => {
    const s = wordStatuses[i] || 'pending';
    if (s === 'error') spelling++;
    else if (s === 'pending') {
      if (i <= lastTyped || countOmissions) omissions++;
    } else if (s === 'half-error') halfCount++;
    else if (s === 'correct') { correctWords++; correctStrokes += String(word).length + 1; }
  });

  return {
    spelling, omissions, additions: addCount, repetitions: repeatedWordCount, halfWords: halfCount, extraSpaces: extraSpaceCount,
    fullErrors: spelling + omissions + addCount + repeatedWordCount,
    halfErrors: halfCount + extraSpaceCount,
    correctWords, correctStrokes,
  };
}
