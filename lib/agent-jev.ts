// Version A: Jev makes the decisions, plain code acts on them, and a language model only writes the analyst summary.
import { config, mockMode } from './config';
import { jev, type JevQuestion } from './jev';
import { chat } from './openai';
import { alertContext, requiredTools, runTool, TOOL_NAMES, TOOLS } from './tools';
import type { Action, Decision, Step, ToolName, Trace, Verdict } from './types';

export const VERDICT_CRITERIA: Record<Verdict, string> = {
  legitimate: 'The customer, or someone they authorized, did this. It fits their normal behavior or the evidence explains it (for example travel bookings, a new device that passed a two-factor check, earlier purchases at the same place, or an authorized user).',
  card_not_present_fraud: "Someone used the customer's card details online without permission: an unfamiliar device or hidden location, odd hours, and a merchant or amount unlike the customer's normal spending.",
  account_takeover: "Someone else got into the customer's online banking: a sign-in from a new device, then password or contact details changed, a new payee added and money sent out.",
  card_testing: 'A burst of tiny charges within minutes from an unfamiliar device, as if someone is checking whether stolen card details work before a bigger purchase.',
};

export const DECISION_QUESTIONS: Record<string, JevQuestion> = {
  verdict: {
    type: 'choice',
    instructions: 'Given everything in `evidence`, who most likely carried out the activity in `alert`?',
    criteria: VERDICT_CRITERIA,
  },
  explained: {
    type: 'noul',
    instructions: 'Every unusual thing about the activity in `alert` is explained by something in `evidence`, such as travel bookings, a new device that passed a two-factor check, earlier purchases at the same place, an authorized user, or a change the bank verified with the customer.',
    criteria: { true: 'Fully explained by the evidence', false: 'At least one unusual thing is not explained' },
  },
  scam_risk: {
    type: 'noul',
    instructions: 'The customer may be being pressured or tricked into sending money or buying gift cards themselves (for example an urgent transfer to a payee added minutes earlier, an "investment", or gift cards from a merchant with many fraud reports).',
    criteria: { true: 'Signs the customer may be the victim of a scam', false: 'No signs of a scam' },
  },
};

function planQuestions(optional: ToolName[]): Record<string, JevQuestion> {
  return Object.fromEntries(
    optional.map((n) => [
      n,
      {
        type: 'noul',
        instructions: {
          question: 'Would running the check described in `check` help decide whether the activity in `alert` was really done by the customer?',
          check: `${TOOLS[n].title}: ${TOOLS[n].description}`,
        },
      } satisfies JevQuestion,
    ]),
  );
}

/** The code rules. Jev gives probabilities; this function decides what happens. */
export function decide(p: { legit: number; verdict: Verdict; explained: number; scam: number; amount: number }): Decision {
  const pFraud = 1 - p.legit;
  const guard: string[] = [];
  if (p.amount >= config.maxAutoCloseAmount) guard.push(`amount is $${config.maxAutoCloseAmount.toLocaleString()} or more`);
  if (p.scam >= config.scamRiskAt) guard.push(`scam risk ${p.scam.toFixed(2)} ≥ ${config.scamRiskAt}`);

  if (p.verdict === 'legitimate' && p.legit >= config.closeAt && p.explained >= config.explainedAt && guard.length === 0) {
    return { action: 'close', verdict: 'legitimate', confidence: p.legit, reason: `Legitimate ${p.legit.toFixed(2)} ≥ ${config.closeAt} and explained ${p.explained.toFixed(2)} ≥ ${config.explainedAt}, so Wes closes it on its own.` };
  }
  if (p.verdict !== 'legitimate' && pFraud >= config.escalateAt) {
    return { action: 'escalate', verdict: p.verdict, confidence: pFraud, reason: `Fraud ${pFraud.toFixed(2)} ≥ ${config.escalateAt}, so it goes to the fraud team with a recommendation. A person approves any card block or freeze.` };
  }
  const why = guard.length
    ? `Guardrail: ${guard.join('; ')}. Wes may not close this alone.`
    : p.verdict === 'legitimate'
      ? `Leans legitimate (${p.legit.toFixed(2)}), but below the bar to close alone (legitimate ≥ ${config.closeAt} and explained ≥ ${config.explainedAt}).`
      : `Leans ${p.verdict.replace(/_/g, ' ')} (${pFraud.toFixed(2)}), but below the ${config.escalateAt} bar to escalate as confirmed fraud.`;
  return { action: 'analyst', verdict: p.verdict, confidence: Math.max(p.legit, pFraud), reason: `${why} Sent to an analyst.` };
}

export async function summarize(ctx: unknown, evidence: unknown, decision: Decision, hint?: unknown) {
  const r = await chat(
    {
      messages: [
        { role: 'system', content: 'You write case summaries for bank fraud analysts. Plain English, 2-3 short sentences, only facts from the data given. Then one recommended next step. Never invent facts.' },
        { role: 'user', content: JSON.stringify({ alert: ctx, evidence, agent_decision: decision }) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'case_summary', strict: true, schema: { type: 'object', additionalProperties: false, required: ['summary', 'recommendation'], properties: { summary: { type: 'string' }, recommendation: { type: 'string' } } } },
      },
    },
    { kind: 'summary', ctx, decision, ...((hint as object) ?? {}) },
  );
  let parsed = { summary: r.message.content ?? '', recommendation: '' };
  try { parsed = JSON.parse(r.message.content ?? '{}'); } catch { /* keep raw text */ }
  return { ...parsed, usage: r.usage, ms: r.ms, model: r.model };
}

export async function runJevAgent(alertId: string): Promise<Trace> {
  const t0 = Date.now();
  const steps: Step[] = [];
  const tokens = { jevIn: 0, openaiIn: 0, openaiOut: 0 };
  const models: Trace['models'] = {};

  const ctx = alertContext(alertId);
  steps.push({ kind: 'context', label: 'Read the alert', detail: ctx.what_happened, data: ctx });

  // 1. Plan: code runs the required checks; Jev decides which optional checks are worth running.
  const required = requiredTools(alertId);
  const optional = TOOL_NAMES.filter((n) => !required.includes(n));
  const plan = await jev({ alert: ctx }, planQuestions(optional));
  models.jev = plan.model;
  tokens.jevIn += plan.usage.input_tokens;
  const chosen = optional.filter((n) => (plan.answers[n]?.noul ?? 0) >= config.checkAt);
  steps.push({
    kind: 'plan', label: 'Jev chose which checks to run', ms: plan.ms,
    detail: `Always run: ${required.map((n) => TOOLS[n].title).join(', ')}. Jev added: ${chosen.length ? chosen.map((n) => TOOLS[n].title).join(', ') : 'none'}.`,
    data: Object.fromEntries(optional.map((n) => [n, plan.answers[n]?.noul ?? null])),
  });

  // 2. Run the checks (plain code over bank records).
  const toolsUsed = [...required, ...chosen];
  const evidence: Record<string, unknown> = {};
  for (const n of toolsUsed) {
    const ts = Date.now();
    evidence[n] = runTool(n, alertId);
    steps.push({ kind: 'tool', label: TOOLS[n].title, ms: Date.now() - ts, data: evidence[n] });
  }

  // 3. Decide: Jev answers typed questions with probabilities.
  const dec = await jev({ alert: ctx, evidence }, DECISION_QUESTIONS);
  tokens.jevIn += dec.usage.input_tokens;
  const v = dec.answers.verdict;
  const probs = (v?.probabilities ?? {}) as Record<Verdict, number>;
  const verdict = (v?.choice ?? 'legitimate') as Verdict;
  const legit = probs.legitimate ?? (verdict === 'legitimate' ? v?.confidence ?? 0 : 0);
  const explained = dec.answers.explained?.noul ?? 0;
  const scam = dec.answers.scam_risk?.noul ?? 0;
  steps.push({ kind: 'decide', label: 'Jev answered the decision questions', ms: dec.ms, data: { verdict: probs, explained, scam_risk: scam } });

  // 4. Code rules turn probabilities into an action.
  const decision = decide({ legit, verdict, explained, scam, amount: ctx.approved_total || ctx.triggering_activity.reduce((s, x) => s + x.amount, 0) });
  steps.push({ kind: 'rule', label: actionLabel(decision.action, decision.verdict), detail: decision.reason });
  const decisionMs = Date.now() - t0;

  // 5. Only cases a person will read get a written summary.
  // If the summary call fails, the decision still stands: the summary is a convenience for the analyst, not part of the decision.
  let summary: Trace['summary'];
  let summaryError: string | undefined;
  if (decision.action !== 'close') {
    try {
      const s = await summarize(ctx, evidence, decision, { evidence });
      tokens.openaiIn += s.usage.prompt_tokens;
      tokens.openaiOut += s.usage.completion_tokens;
      models.openai = s.model;
      summary = { text: s.summary, recommendation: s.recommendation };
      steps.push({ kind: 'summary', label: 'AI model wrote the analyst summary', ms: s.ms });
    } catch (e) {
      summaryError = (e as Error).message;
      steps.push({ kind: 'summary', label: 'Summary could not be written (the decision still stands)', detail: summaryError.slice(0, 160) });
    }
  }

  const costUsd =
    (tokens.jevIn / 1e6) * config.jevPricePerMInput +
    (tokens.openaiIn / 1e6) * config.openaiPricePerMInput +
    (tokens.openaiOut / 1e6) * config.openaiPricePerMOutput;

  return {
    alertId, mode: 'jev', mock: mockMode(), models, steps, toolsUsed,
    jev: { plan: plan.answers, decision: dec.answers },
    decision, summary, costUsd, decisionMs, totalMs: Date.now() - t0, tokens, invalidOutput: false,
    ...(summaryError ? { summaryError } : {}),
  };
}

export function actionLabel(a: Action, v: Verdict) {
  if (a === 'close') return 'Closed: not fraud';
  if (a === 'escalate') return `Escalated: ${v.replace(/_/g, ' ').replace('card not present', 'stolen card online')}`;
  return 'Sent to analyst';
}
