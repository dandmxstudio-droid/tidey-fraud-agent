import type { Action, AnswerKey, Verdict } from './types';

export const VERDICT_LABEL: Record<Verdict, string> = {
  legitimate: 'Legitimate',
  card_not_present_fraud: 'Stolen card used online',
  account_takeover: 'Account takeover',
  card_testing: 'Card testing',
};

export const ANSWER_LABEL: Record<AnswerKey['label'], string> = {
  ...VERDICT_LABEL,
  unclear: 'Unclear: a person should look',
};

export function actionText(a: Action, v?: Verdict) {
  if (a === 'close') return 'Closed: not fraud';
  if (a === 'escalate') return v ? `Escalated: ${VERDICT_LABEL[v].toLowerCase()}` : 'Escalated';
  return 'Sent to analyst';
}

export const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
export const usd = (n: number) => (n === 0 ? '$0' : n < 0.0001 ? '<$0.0001' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`);
export const secs = (ms: number) => (ms < 10 ? '<0.01 s' : ms < 1000 ? `${(ms / 1000).toFixed(2)} s` : `${(ms / 1000).toFixed(1)} s`);

// The three queue groups, in the order analysts see them.
export const GROUPS: { key: Action; title: string; label: string; short: string; blurb: string }[] = [
  { key: 'analyst', title: 'Needs Your Call', label: 'Needs Your Call', short: 'need your call', blurb: 'Mixed signals. Tidey explains what is unclear and suggests a next step.' },
  { key: 'escalate', title: 'Fraud, Waiting for Your Approval', label: 'Fraud to Approve', short: 'fraud to approve', blurb: 'Tidey found fraud and recommends a block or hold. Nothing happens until you approve it.' },
  { key: 'close', title: 'Closed by Tidey', label: 'Closed by Tidey', short: 'closed by Tidey', blurb: 'False alarms Tidey closed on its own. Every one keeps its evidence, so you can spot-check.' },
];
export const isAction = (v: string | null | undefined): v is Action => v === 'analyst' || v === 'escalate' || v === 'close';

// Readable model name: 'gpt-5.4-mini-2026-03-17' -> 'GPT-5.4 mini'.
export const modelName = (id?: string) =>
  (id || 'gpt-5.4-mini').replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/^gpt-/i, 'GPT-').replace(/-mini$/i, ' mini');

// Title case for labels that are shared with model prompts and stored runs, so the source text stays as it was tested.
const MINOR = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'to', 'in', 'on', 'at', 'by', 'of', 'as']);
export const titleCase = (s: string) =>
  s.split(' ').map((w, i, all) => (i > 0 && i < all.length - 1 && MINOR.has(w) ? w : w.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-'))).join(' ');
