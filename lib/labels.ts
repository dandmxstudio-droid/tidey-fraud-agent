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
  { key: 'analyst', title: 'Needs your call', label: 'Need your call', short: 'need your call', blurb: 'Mixed signals. Tidey explains what is unclear and suggests a next step.' },
  { key: 'escalate', title: 'Fraud, waiting for your approval', label: 'Fraud to approve', short: 'fraud to approve', blurb: 'Tidey found fraud and recommends a block or hold. Nothing happens until you approve it.' },
  { key: 'close', title: 'Closed by Tidey', label: 'Closed by Tidey', short: 'closed by Tidey', blurb: 'False alarms Tidey closed on its own. Every one keeps its evidence, so you can spot-check.' },
];
export const isAction = (v: string | null | undefined): v is Action => v === 'analyst' || v === 'escalate' || v === 'close';
