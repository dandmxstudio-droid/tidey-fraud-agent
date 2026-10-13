// Scoring against the answer key. The key is read only here, after a decision is made; neither agent ever sees it.
import keyJson from '@/data/answer_key.json';
import type { AnswerKey, Decision, Score } from './types';

const key = new Map((keyJson as AnswerKey[]).map((k) => [k.alert_id, k]));

export function score(alertId: string, d: Decision): Score {
  const k = key.get(alertId);
  if (!k) throw new Error(`No answer for ${alertId}`);
  const isFraud = k.label !== 'legitimate' && k.label !== 'unclear';
  return {
    label: k.label,
    needsHuman: k.needs_human,
    expectedAction: k.expected_action,
    why: k.why,
    // Unclear cases are correct as long as a person sees them (analyst or fraud team).
    correct: k.needs_human ? d.action !== 'close' : d.action === k.expected_action,
    // The costly error: fraud (or an unclear case) closed with no person looking.
    missedFraud: k.label !== 'legitimate' && d.action === 'close',
    // Wasted analyst time: a legitimate alert sent to a person.
    unnecessaryReview: k.label === 'legitimate' && d.action !== 'close',
    typeCorrect: isFraud && d.action === 'escalate' ? d.verdict === k.label : null,
  };
}
