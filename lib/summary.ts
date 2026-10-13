// Aggregate scores for one version across a run. Safe to import in the browser.
import type { RunResult } from './types';

export type RunSummary = {
  alerts: number;
  correct: number;
  missedFraud: number;
  unnecessaryReviews: number;
  unclearSentToPerson: number;
  unclearTotal: number;
  fraudCaught: number;
  fraudTotal: number;
  typeCorrect: number;
  typeTotal: number;
  autoHandled: number;
  avgCostUsd: number;
  avgDecisionMs: number;
  avgTotalMs: number;
  invalidOutputs: number;
  errors: number;
};

export function summarizeRun(rs: RunResult[]): RunSummary {
  const n = rs.length || 1;
  const fraud = rs.filter((r) => !['legitimate', 'unclear'].includes(r.score.label));
  const unclear = rs.filter((r) => r.score.label === 'unclear');
  const typed = rs.filter((r) => r.score.typeCorrect !== null);
  return {
    alerts: rs.length,
    correct: rs.filter((r) => r.score.correct).length,
    missedFraud: rs.filter((r) => r.score.missedFraud).length,
    unnecessaryReviews: rs.filter((r) => r.score.unnecessaryReview).length,
    unclearSentToPerson: unclear.filter((r) => r.trace.decision.action !== 'close').length,
    unclearTotal: unclear.length,
    fraudCaught: fraud.filter((r) => r.trace.decision.action !== 'close').length,
    fraudTotal: fraud.length,
    typeCorrect: typed.filter((r) => r.score.typeCorrect).length,
    typeTotal: typed.length,
    autoHandled: rs.filter((r) => r.trace.decision.action === 'close').length,
    avgCostUsd: rs.reduce((s, r) => s + r.trace.costUsd, 0) / n,
    avgDecisionMs: rs.reduce((s, r) => s + r.trace.decisionMs, 0) / n,
    avgTotalMs: rs.reduce((s, r) => s + r.trace.totalMs, 0) / n,
    invalidOutputs: rs.filter((r) => r.trace.invalidOutput).length,
    errors: rs.filter((r) => r.trace.error).length,
  };
}
