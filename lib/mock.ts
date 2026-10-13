// MOCK MODE ONLY. Stand-in answers so the app can be built and clicked through without API keys.
// These rules are deliberately simple and never read the answer key. Real runs use Jev and OpenAI.
import type { JevAnswer, JevQuestion } from './jev';
import { alertContext, runTool, TOOL_NAMES } from './tools';
import type { ToolName, Verdict } from './types';

type Ctx = ReturnType<typeof alertContext>;
const sig = (x: number) => 1 / (1 + Math.exp(-x));
const r2 = (x: number) => Math.round(x * 100) / 100;

function risk(ctx: Ctx, ev: Record<string, any>) {
  let r = 0;
  const items = ctx.triggering_activity;
  const t = items[items.length - 1];
  const th = ev.transaction_history, dv = ev.devices_and_signins, ac = ev.account_changes, mp = ev.merchant_profile, pa = ev.prior_alerts;
  if (t.hour_of_day <= 5) r += 1.5;
  if (t.location_hidden_by_proxy) r += 2;
  const far = (t.distance_from_home_miles ?? 0) > 300;
  const travel = (th?.travel_bookings?.length ?? 0) > 0;
  const seenLoc = (th?.trigger_comparison?.[0]?.earlier_activity_in_this_location ?? 0) > 0;
  if (far && !travel && !seenLoc) r += 1.5;
  if (far && (travel || seenLoc)) r -= 1.5;
  const newDev = t.device?.first_seen_today;
  const passed2fa = (dv?.recent_sign_ins ?? []).some((s: any) => s.device_first_seen_today && /passed/.test(s.details ?? ''));
  if (newDev) r += passed2fa ? -1.5 : 1.5;
  const fr = mp?.merchants?.[0]?.fraud_reports_last_90_days_across_bank ?? 0;
  if (fr >= 10) r += 1.5;
  if ((th?.trigger_comparison?.[0]?.purchases_at_this_merchant_before ?? 0) > 0) r -= 1.5;
  if (items.length >= 4 && items.filter((x) => x.amount <= 5).length >= 4) r += 2.5;
  const changes = (ac?.changes ?? []).map((c: any) => c.change as string);
  if (changes.some((c: string) => /verified/.test(c))) r -= 2;
  if (changes.some((c: string) => /Authorized user/.test(c))) r -= 1;
  if (changes.includes('Password reset') && changes.includes('New payee added') && (ac?.changes ?? []).some((c: any) => c.device_first_seen_today)) r += 3;
  if ((t.times_customer_average_purchase ?? 0) >= 10) r += 0.8;
  if (ctx.declined_count > 0) r += 1;
  if ((pa?.prior_alerts ?? []).some((p: any) => p.outcome === 'legitimate')) r -= 2;
  return r;
}

function verdictFor(ctx: Ctx, ev: Record<string, any>): Verdict {
  const items = ctx.triggering_activity;
  if (items.filter((x) => x.amount <= 5).length >= 4) return 'card_testing';
  if (items.some((x) => x.channel === 'transfer')) return 'account_takeover';
  return 'card_not_present_fraud';
}

export function mockJev(state: any, questions: Record<string, JevQuestion>): { model: string; answers: Record<string, JevAnswer>; usage: { input_tokens: number; output_tokens: number } } {
  const ctx: Ctx = state.alert;
  const tokens = Math.round(JSON.stringify(state).length / 4);
  const answers: Record<string, JevAnswer> = {};
  if ('verdict' in questions) {
    const ev = state.evidence ?? {};
    const r = risk(ctx, ev);
    const pFraud = sig(r - 1.2);
    const fraudType = verdictFor(ctx, ev);
    const probs: Record<string, number> = { legitimate: r2(1 - pFraud), card_not_present_fraud: 0, account_takeover: 0, card_testing: 0 };
    probs[fraudType] = r2(pFraud * 0.85);
    const others = (['card_not_present_fraud', 'account_takeover', 'card_testing'] as const).filter((x) => x !== fraudType);
    probs[others[0]] = r2(pFraud * 0.1);
    probs[others[1]] = r2(1 - probs.legitimate - probs[fraudType] - probs[others[0]]);
    const choice = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0];
    answers.verdict = { type: 'choice', choice, probabilities: probs, confidence: r2(Math.abs(probs[choice] - 0.25) / 0.75) };
    answers.unexplained = { type: 'noul', noul: r2(r < -0.5 ? 0.1 : r < 1 ? 0.45 : 0.92) };
    const t = ctx.triggering_activity[ctx.triggering_activity.length - 1];
    const scam = (t.memo && /urgent|investment/i.test(t.memo)) || (t.merchant_category === 'gift cards' && !t.device?.first_seen_today);
    answers.scam_risk = { type: 'noul', noul: scam ? 0.72 : 0.08 };
  } else {
    const t = ctx.triggering_activity[0];
    for (const k of Object.keys(questions)) {
      const v: Record<string, number> = {
        devices_and_signins: t.channel === 'online' || t.channel === 'transfer' ? 0.86 : 0.31,
        account_changes: t.channel === 'transfer' || /Contact|payee/i.test(ctx.rule_triggered) || t.device?.first_seen_today ? 0.78 : 0.34,
        prior_alerts: 0.58,
        merchant_profile: t.merchant ? 0.74 : 0.12,
        payee_details: t.channel === 'transfer' ? 0.9 : 0.06,
        transaction_history: 0.9,
      };
      answers[k] = { type: 'noul', noul: v[k] ?? 0.5 };
    }
  }
  return { model: 'mock-jev', answers, usage: { input_tokens: tokens, output_tokens: 0 } };
}

export function mockChat(body: any, hint: any) {
  const inTok = Math.round(JSON.stringify(body.messages).length / 4);
  if (hint?.kind === 'summary') {
    const ctx: Ctx = hint.ctx;
    const d = hint.decision;
    const t = ctx.triggering_activity[ctx.triggering_activity.length - 1];
    const text = `${ctx.what_happened} for ${ctx.customer.name} (home: ${ctx.customer.home_city}). ${t.device?.first_seen_today ? 'The device was first seen today. ' : ''}${t.location_hidden_by_proxy ? 'The location is hidden behind a proxy. ' : ''}[Mock summary: the real one is written by the AI model.]`;
    const rec = d.action === 'escalate' ? 'Block the card or hold the transfer, then contact the customer.' : 'Call the customer to confirm the activity before taking action.';
    return { message: { content: JSON.stringify({ summary: text, recommendation: rec }) }, usage: { prompt_tokens: inTok, completion_tokens: 80 }, model: 'mock-openai' };
  }
  const ctx: Ctx = hint.ctx;
  const t = ctx.triggering_activity[0];
  const plan: ToolName[][] = [
    ['transaction_history', 'devices_and_signins'],
    t.channel === 'transfer' ? ['account_changes', 'payee_details'] : ['merchant_profile', 'account_changes'],
  ];
  if (hint.turn < plan.length) {
    const calls = plan[hint.turn].map((n, i) => ({ id: `call_${hint.turn}_${i}`, type: 'function' as const, function: { name: n, arguments: '{}' } }));
    return { message: { content: null, tool_calls: calls }, usage: { prompt_tokens: inTok, completion_tokens: 40 }, model: 'mock-openai' };
  }
  const ev: Record<string, unknown> = {};
  for (const n of [...plan[0], ...plan[1]]) if (TOOL_NAMES.includes(n)) ev[n] = runTool(n, ctx.alert_id);
  const r = risk(ctx, ev as any);
  const pFraud = sig(r - 1.2);
  const verdict: Verdict = pFraud > 0.5 ? verdictFor(ctx, ev as any) : 'legitimate';
  const action = pFraud < 0.3 ? 'close' : pFraud > 0.7 ? 'escalate' : 'analyst';
  const out = { verdict, confidence: r2(Math.max(pFraud, 1 - pFraud)), action, summary: `${ctx.what_happened}. [Mock summary from the stand-in model.]`, recommendation: action === 'escalate' ? 'Block the card and contact the customer.' : action === 'close' ? 'No action needed.' : 'Call the customer to confirm.' };
  return { message: { content: JSON.stringify(out) }, usage: { prompt_tokens: inTok, completion_tokens: 120 }, model: 'mock-openai' };
}
