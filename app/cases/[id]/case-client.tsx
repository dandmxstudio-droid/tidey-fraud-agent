'use client';
import { useEffect, useState } from 'react';
import { closedReason, firstSentence, toolHeadline } from '@/lib/headlines';
import { ANSWER_LABEL, GROUPS, VERDICT_LABEL, isAction, money, secs, usd } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, runOne, saveLive, type Pair, type RunFile } from '@/lib/store';
import type { Action, RunResult, Step, ToolName, Verdict } from '@/lib/types';
import { StateIcon, TideyBadge } from '../../brand';
import { CHOICES, loadDecisions, outcome, saveDecision, type Choice, type Decided } from '@/lib/decisions';

type A = { id: string; what_happened: string; amount: number; rule_triggered: string };

const TOOL_KEY: Record<string, ToolName> = {
  'Transaction history': 'transaction_history', 'Devices and sign-ins': 'devices_and_signins', 'Account changes': 'account_changes',
  'Past alerts': 'prior_alerts', 'Merchant check': 'merchant_profile', 'Payee check': 'payee_details',
};
const STATUS: Record<Exclude<Action, 'close'>, string> = { escalate: 'Waiting for your approval', analyst: 'Waiting for your decision' };
const PROPOSAL: Partial<Record<Verdict, string>> = {
  card_not_present_fraud: 'blocking the card and sending the customer a new one',
  card_testing: 'blocking the card and sending the customer a new one',
  account_takeover: 'freezing online banking and holding the transfer until the customer verifies',
};
const FOUND: Partial<Record<Verdict, string>> = { card_not_present_fraud: 'a stolen card used online', account_takeover: 'an account takeover', card_testing: 'card testing on this card' };
const TOOL_TITLE: Record<string, string> = Object.fromEntries(Object.entries(TOOL_KEY).map(([k, v]) => [v, k]));

const has = (f: RunFile | null, id: string) => f?.results.find((r) => r.alertId === id) ?? null;

export function CaseClient({ alert, featured, from, view: viewParam, runKind }: { alert: A; featured: boolean; from: 'queue' | 'proof'; view?: string; runKind?: string }) {
  const [pair, setPair] = useState<Pair | null>(null);
  const [run, setRun] = useState<RunFile | null>(null);
  const [mode, setMode] = useState<'jev' | 'llm'>('jev');
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [decisions, setDecisions] = useState<Record<string, Decided>>({});

  useEffect(() => setDecisions(loadDecisions()), []);

  // Read the same run the previous page showed: the queue prefers the official run, the test results page says which one it showed.
  useEffect(() => {
    const live = loadLive();
    loadOfficial().then((official) => {
      const wanted = from === 'proof' && runKind === 'live' ? live : from === 'proof' && runKind === 'official' ? official : official ?? live;
      const file = has(wanted, alert.id) ? wanted : has(live, alert.id) ? live : has(official, alert.id) ? official : wanted;
      setRun(file);
      setPair(has(file, alert.id));
    });
  }, [alert.id, from, runKind]);

  async function runThis() {
    setBusy(true); setErr('');
    const [jev, llm] = await Promise.all([runOne(alert.id, 'jev', pass), runOne(alert.id, 'llm', pass)]);
    const p: Pair = { alertId: alert.id, jev, llm };
    if (!isOk(jev)) setErr((jev as { error: string }).error);
    setPair(p);
    const live: RunFile = loadLive() ?? { kind: 'live', run_at: new Date().toISOString(), mock: (isOk(jev) && jev.trace.mock) || false, settings: { closeAt: 0, unexplainedMax: 0, escalateAt: 0, scamRiskAt: 0, maxAutoCloseAmount: 0, checkAt: 0, jevModel: isOk(jev) ? jev.trace.models.jev ?? '' : '', openaiModel: isOk(llm) ? llm.trace.models.openai ?? '' : '' }, results: [] };
    live.results = [...live.results.filter((r) => r.alertId !== alert.id), p];
    saveLive(live);
    if (!run) setRun(live);
    setBusy(false);
  }

  const r = pair ? (mode === 'jev' ? pair.jev : pair.llm) : undefined;

  // Previous and next stay inside the group (or the test list) the analyst came from.
  // Opened from the Handled view: paging moves through the alerts already decided.
  const fromHandled = from !== 'proof' && viewParam === 'handled';
  const view = from === 'proof' ? null : isAction(viewParam) ? viewParam : pair && isOk(pair.jev) ? pair.jev.trace.decision.action : null;
  const list = (run?.results ?? [])
    .filter((p) => (from === 'proof' ? true : fromHandled ? !!decisions[p.alertId] || p.alertId === alert.id : view && isOk(p.jev) && p.jev.trace.decision.action === view))
    .map((p) => p.alertId);
  const idx = list.indexOf(alert.id);
  const query = from === 'proof' ? `?from=proof&run=${run?.kind ?? 'official'}` : fromHandled ? '?view=handled' : view ? `?view=${view}` : '';
  const caseHref = (id?: string) => (id ? `/cases/${id}${query}` : undefined);
  const prev = caseHref(list[idx - 1]);
  const next = caseHref(list[idx + 1]);
  const back = from === 'proof' ? { href: '/proof', label: 'Back to test results' } : fromHandled ? { href: '/?view=handled', label: 'Back to handled' } : { href: !view || view === 'escalate' ? '/' : `/?view=${view}`, label: 'Back to the queue' };
  const where = from === 'proof' ? 'in the test' : fromHandled ? 'handled' : GROUPS.find((g) => g.key === view)?.short ?? '';
  // After a call, "Next alert" skips to the next one nobody has decided yet.
  const open = list.filter((id) => !decisions[id]);
  const after = [...list.slice(idx + 1), ...list.slice(0, Math.max(0, idx))].find((id) => !decisions[id] && id !== alert.id);
  const decide = (d: Decided | null) => setDecisions(saveDecision(alert.id, d));
  const leftN = open.filter((id) => id !== alert.id).length;
  const leftText =
    fromHandled ? 'Kept in Handled' :
    from === 'proof' ? (leftN ? `${leftN} undecided left in the test` : 'That was the last undecided alert in the test')
    : view === 'escalate' ? (leftN ? `${leftN} fraud ${leftN === 1 ? 'approval' : 'approvals'} left` : 'That was the last fraud approval')
    : view === 'analyst' ? (leftN ? `${leftN} judgment ${leftN === 1 ? 'call' : 'calls'} left` : 'That was the last judgment call')
    : leftN ? `${leftN} left to spot-check` : 'That was the last one to spot-check';

  return (
    <>
      <div className="case-nav">
        <a href={back.href} className="back"><Chevron dir="left" />{back.label}</a>
        {idx >= 0 && list.length > 1 && (
          <div className="pager" aria-label="Move between alerts">
            <span className="pager-count">{idx + 1} of {list.length}<span className="pager-where"> {where}</span></span>
            {prev ? <a className="btn pager-btn" href={prev}><Chevron dir="left" />Previous</a> : <span className="btn pager-btn" aria-disabled="true"><Chevron dir="left" />Previous</span>}
            {next ? <a className="btn pager-btn" href={next}>Next<Chevron dir="right" /></a> : <span className="btn pager-btn" aria-disabled="true">Next<Chevron dir="right" /></span>}
          </div>
        )}
      </div>
      {r && isOk(r) && <Assessment key={`a-${mode}`} r={r} decided={mode === 'jev' ? decisions[alert.id] : undefined} />}
      <div className="case-head">
        <div>
          <p className="kicker">{alert.id}, flagged by the rule “{alert.rule_triggered}”</p>
          <h1>{alert.what_happened}</h1>
        </div>
        {pair && (
          <div className="seg" role="tablist" aria-label="Which version">
            <button className={mode === 'jev' ? 'on' : ''} onClick={() => setMode('jev')}>Tidey</button>
            <button className={mode === 'llm' ? 'on' : ''} onClick={() => setMode('llm')}>Baseline (test only)</button>
          </div>
        )}
      </div>

      {!pair && (
        <div className="panel">
          <h2>Not investigated yet</h2>
          <p className="muted" style={{ marginTop: 0 }}>Run this alert through Tidey and the baseline to see the investigation.</p>
          <div className="row">
            {!featured && <input className="pass" type="password" placeholder="Owner passcode" value={pass} onChange={(e) => setPass(e.target.value)} />}
            <button className="btn primary" disabled={busy || (!featured && !pass)} onClick={runThis}>{busy ? 'Investigating…' : 'Investigate this alert'}</button>
          </div>
          {err && <p className="no small">{err}</p>}
        </div>
      )}

      {r && !isOk(r) && <div className="panel"><b>This run failed.</b> {r.error}</div>}
      {r && isOk(r) && (
        <CaseView
          key={mode}
          r={r}
          bar={
            mode === 'jev' && pair && isOk(pair.jev) ? (
              <DecisionBar
                r={r}
                group={pair.jev.trace.decision.action}
                decided={decisions[alert.id]}
                onDecide={decide}
                nextOpen={caseHref(after)}
                leftText={leftText}
                back={back}
              />
            ) : null
          }
        />
      )}
    </>
  );
}

const WORK_MS = 1100;
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// Tidey's assessment, shown near the top so the analyst knows what they're checking. The decision itself lives in the bar at the bottom.
function Assessment({ r, decided }: { r: RunResult; decided?: Decided }) {
  const d = r.trace.decision;
  const tidey = r.trace.mode === 'jev';
  const who = tidey ? 'Tidey' : 'The baseline';
  const rec = r.trace.summary?.recommendation;
  let title = '', body = '';
  if (d.action === 'close') {
    title = `${who} closed this as a false alarm`;
    body = tidey ? `${closedReason(r)}.` : 'The model judged it legitimate.';
  } else if (d.action === 'escalate') {
    title = `${who} found ${FOUND[d.verdict] ?? VERDICT_LABEL[d.verdict].toLowerCase()}`;
    // Escalation already happened: this is the approval step, so say what will be approved.
    body = tidey ? `${who} recommends ${PROPOSAL[d.verdict] ?? 'blocking the card'}.` : rec || 'The model recommends a block.';
  } else {
    title = `${who} needs your call`;
    body = rec || firstSentence(d.reason);
  }
  const o = decided ? outcome(decided.choice, d.verdict) : null;

  return (
    <div className={`verdict ${o ? 'decided' : d.action}`}>
      <div className="verdict-say">
        {tidey && <TideyBadge size={38} />}
        <div className="vs-body">
          <div className="vs-head">
            <h2>{title}</h2>
            {o && decided ? (
              <span className={`status-pill ${o.state}`}><StateIcon state={o.state} />{o.title}, {clockTime(decided.at)}</span>
            ) : (
              <span className={`status-pill ${tidey ? d.action : 'baseline'}`}>
                <i className={d.action === 'close' || !tidey ? '' : 'pulsing'} />
                {!tidey ? 'Baseline, test only' : d.action === 'close' ? 'Closed by Tidey' : STATUS[d.action]}
              </span>
            )}
          </div>
          <p>{body}</p>
        </div>
      </div>
    </div>
  );
}

const ASK: Record<Action, { q: string; hint: string }> = {
  escalate: { q: 'Approve Tidey’s block?', hint: 'Nothing happens to the card or account until you do.' },
  analyst: { q: 'What’s your call?', hint: 'Tidey wasn’t sure. Decide once you’ve checked the evidence above.' },
  close: { q: 'Was Tidey right to close this?', hint: 'Spot-check the evidence above.' },
};

type BarProps = {
  r: RunResult;
  group: Action;
  decided?: Decided;
  onDecide: (d: Decided | null) => void;
  nextOpen?: string;
  leftText: string;
  back: { href: string; label: string };
};

// The decision, pinned to the bottom of the screen so it's in reach after reading the whole case.
// After a click, Tidey does the work in the bar, then the bar shows the result.
function DecisionBar({ r, group, decided, onDecide, nextOpen, leftText, back }: BarProps) {
  const d = r.trace.decision;
  const [working, setWorking] = useState<Choice | null>(null);
  const act = (c: Choice) => {
    setWorking(c);
    window.setTimeout(() => {
      onDecide({ choice: c, at: new Date().toISOString() });
      setWorking(null);
    }, WORK_MS);
  };

  if (decided && !working) {
    const o = outcome(decided.choice, d.verdict);
    return (
      <div className={`decision-bar done ${o.state}`} role="status">
        <span className="resolved-mark"><StateIcon state={o.state} size={20} /></span>
        <div className="db-text">
          <b>{o.title}<span className="demo-tag" title="Nothing real was blocked, sent or saved outside this browser tab">Demo</span></b>
          <span>{o.body}</span>
        </div>
        <div className="db-side">
          <span className="left">{leftText}</span>
          <div className="acts-row">
            <button className="btn quiet" onClick={() => onDecide(null)}>Undo</button>
            {nextOpen ? <a className="btn primary" href={nextOpen}>Next alert</a> : <a className="btn primary" href={back.href}>{back.label}</a>}
          </div>
        </div>
      </div>
    );
  }

  const o = working ? outcome(working, d.verdict) : null;
  return (
    <div className={`decision-bar${working ? ' working' : ''}`}>
      <div className="db-text">
        <b>{ASK[group].q}</b>
        <span>{ASK[group].hint}</span>
      </div>
      <div className="acts-row">
        {o ? (
          <span className="working-note" role="status"><span className="spinner" aria-hidden="true" />{o.working}</span>
        ) : (
          CHOICES[group].map((a) => <button key={a.choice} className={a.cls} onClick={() => act(a.choice)}>{a.label}</button>)
        )}
      </div>
    </div>
  );
}

function CaseView({ r, bar }: { r: RunResult; bar: React.ReactNode }) {
  const t = r.trace;
  const ctx = t.steps[0]?.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const decide = t.steps.find((s) => s.kind === 'decide');
  const rule = t.steps.find((s) => s.kind === 'rule');

  return (
    <>
      {ctx && <KeyFacts ctx={ctx} />}
      <div className="case-grid">
        <div className="stack">
          {t.summary && (
            <section className="panel">
              <p className="label">{t.mode === 'jev' ? 'Tidey’s summary' : 'The baseline’s summary'}</p>
              <p className="summary">{t.summary.text}</p>
            </section>
          )}
          <section className="panel">
            <p className="label">How the case was investigated</p>
            <Timeline r={r} />
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <p className="label">The customer</p>
            <dl className="facts">
              <dt>Name</dt><dd>{ctx?.customer?.name}</dd>
              <dt>Customer since</dt><dd>{ctx?.customer?.customer_since?.slice(0, 4)}</dd>
              <dt>Home</dt><dd>{ctx?.customer?.home_city}</dd>
              <dt>Account</dt><dd>{ctx?.customer?.account_type}</dd>
              <dt>Usual purchase</dt><dd>{money(ctx?.customer_average_purchase_90d ?? 0)}</dd>
            </dl>
          </section>

          <section className="panel">
            <p className="label">How the decision was made</p>
            {t.mode === 'jev' ? <JevAnswers step={decide} /> : <ModelAnswer r={r} />}
            {rule?.detail && <div className="rule"><b>{t.mode === 'jev' ? 'Code rule: ' : ''}</b>{rule.detail}</div>}
            <div className="key-note">
              <b>Test answer key:</b> {ANSWER_LABEL[r.score.label]}. {r.score.correct ? <span className="ok">This decision is correct.</span> : <span className="no">This decision is wrong.</span>}
              <div style={{ marginTop: 4 }}>{r.score.why}</div>
              <div style={{ marginTop: 8 }}>
                Decided in {secs(t.decisionMs)} for {usd(t.costUsd)}
                {t.models.jev ? `, ${t.models.jev}` : ''}{t.models.openai ? `, ${t.models.openai}` : ''}{t.mock ? ', mock' : ''}.
              </div>
            </div>
          </section>
        </div>
      </div>
      {bar}
    </>
  );
}

function Timeline({ r }: { r: RunResult }) {
  const t = r.trace;
  const items: { title: string; who?: 'jev'; ms?: number; finding?: string; data?: unknown; plan?: Record<string, number | null> }[] = [];
  for (const s of t.steps) {
    if (s.kind === 'context') items.push({ title: 'Read the alert', finding: `Flagged by “${(s.data as any)?.rule_triggered}”.` }); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (s.kind === 'plan') items.push({ title: 'Jev chose which checks to run', who: 'jev', ms: s.ms, finding: s.detail, plan: s.data as Record<string, number | null> });
    if (s.kind === 'tool') items.push({ title: s.label, ms: s.ms, finding: toolHeadline(TOOL_KEY[s.label], s.data as never), data: s.data });
    if (s.kind === 'model') {
      const outs = (s.data ?? {}) as Record<string, unknown>;
      const names = Object.keys(outs);
      items.push({ title: s.label.replace('AI model ran: ', 'Model ran: '), ms: s.ms, finding: names.map((n) => toolHeadline(TOOL_KEY[n], outs[n] as never)).filter(Boolean).join(' '), data: outs });
    }
    if (s.kind === 'decide') items.push({ title: t.mode === 'jev' ? 'Jev answered the decision questions' : 'Model made its decision', who: t.mode === 'jev' ? 'jev' : undefined, ms: s.ms });
    if (s.kind === 'summary') items.push({ title: s.label.replace('AI model wrote the analyst summary', 'An AI model wrote the summary above'), ms: s.ms, finding: s.detail });
  }
  return (
    <ol className="timeline">
      {items.map((it, i) => (
        <li key={i}>
          <span className={`n ${it.who === 'jev' ? 'jev' : ''}`}>{i + 1}</span>
          <div className="t">{it.title}{it.ms !== undefined && <span>{secs(it.ms)}</span>}</div>
          {it.finding && <div className="f">{it.finding}</div>}
          {it.plan && (
            <div style={{ marginTop: 8 }}>
              {Object.entries(it.plan).map(([k, v]) => <Bar key={k} label={TOOL_TITLE[k] ?? k} v={v ?? 0} warn={(v ?? 0) < 0.5} />)}
            </div>
          )}
          {it.data !== undefined && <details><summary>Show the records it read</summary><pre className="json">{JSON.stringify(it.data, null, 2)}</pre></details>}
        </li>
      ))}
    </ol>
  );
}

function JevAnswers({ step }: { step?: Step }) {
  const d = (step?.data ?? {}) as { verdict?: Record<string, number>; unexplained?: number; scam_risk?: number };
  const verdict = Object.entries(d.verdict ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="q" style={{ marginTop: 0 }}>
        <div className="qt">Who most likely did this?</div>
        {verdict.map(([k, v]) => <Bar key={k} label={VERDICT_LABEL[k as Verdict] ?? k} v={v} />)}
      </div>
      <div className="q">
        <div className="qt">Is anything out of character that the evidence doesn’t explain?</div>
        <Bar label="Yes" v={d.unexplained ?? 0} warn />
      </div>
      <div className="q">
        <div className="qt">Could the customer be the victim of a scam?</div>
        <Bar label="Yes" v={d.scam_risk ?? 0} warn />
      </div>
    </>
  );
}

function ModelAnswer({ r }: { r: RunResult }) {
  const d = r.trace.decision;
  return (
    <>
      <div className="q" style={{ marginTop: 0 }}>
        <div className="qt">Verdict chosen by the model</div>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{VERDICT_LABEL[d.verdict]}</div>
      </div>
      <div className="q">
        <div className="qt">Confidence the model reported</div>
        <Bar label="Confidence" v={d.confidence} />
      </div>
      {r.trace.invalidOutput && <div className="rule">The model’s answer was missing or invalid, so the case went to an analyst.</div>}
    </>
  );
}

function Bar({ label, v, warn }: { label: string; v: number; warn?: boolean }) {
  return (
    <div className="opt"><span>{label}</span><div className={`track ${warn ? 'warn' : ''}`}><b style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} /></div><span>{v.toFixed(2)}</span></div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="chev">
      <path d={dir === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Tx = {
  time: string; hour_of_day: number; amount: number; status: string; channel: 'online' | 'in_store' | 'atm' | 'transfer';
  merchant: string | null; payee: string | null; location: string | null; distance_from_home_miles: number;
  location_hidden_by_proxy: boolean; device: { label: string; first_seen: string; first_seen_today: boolean } | null;
  times_customer_average_purchase?: number;
};
type Ctx = { triggering_activity: Tx[]; approved_total?: number; declined_count?: number; customer_average_purchase_90d?: number; customer?: { home_city?: string } };

const CHANNEL: Record<Tx['channel'], string> = { online: 'Online', in_store: 'In store', atm: 'ATM', transfer: 'Transfer' };
const clock12 = (s: string) => {
  const [hh, mm] = s.slice(11, 16).split(':').map(Number);
  return { t: `${hh % 12 || 12}:${String(mm).padStart(2, '0')}`, ap: hh < 12 ? 'AM' : 'PM' };
};
const dayLabel = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
};
// Lowercase a device name mid-sentence, but keep brand names as written.
const deviceName = (label: string) => (/^(Android|iPhone|iPad|Mac|Windows|Chrome)/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));
const minutesBetween = (a: string, b: string) => {
  const toMin = (s: string) => Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
  return Math.max(1, toMin(b) - toMin(a));
};

// The facts an analyst reads first, straight from the alert: how much, when, where, on what device.
function KeyFacts({ ctx }: { ctx: Ctx }) {
  const txs = ctx.triggering_activity ?? [];
  if (!txs.length) return null;
  const first = txs[0], last = txs[txs.length - 1];
  const n = txs.length;
  const declined = ctx.declined_count ?? 0;
  const total = ctx.approved_total ?? txs.reduce((s, x) => s + x.amount, 0);
  const avg = ctx.customer_average_purchase_90d ?? 0;
  const times = last.times_customer_average_purchase;

  const a = clock12(first.time), b = clock12(last.time);
  const when = n > 1 && first.time !== last.time ? (a.ap === b.ap ? `${a.t}–${b.t} ${b.ap}` : `${a.t} ${a.ap}–${b.t} ${b.ap}`) : `${b.t} ${b.ap}`;
  const whenSub = [dayLabel(last.time), last.hour_of_day < 6 ? 'overnight' : '', n > 1 ? `over ${minutesBetween(first.time, last.time)} min` : ''].filter(Boolean).join(', ');

  const away = last.distance_from_home_miles > 0 ? `${last.distance_from_home_miles.toLocaleString()} miles from home` : 'their home city';
  const where = last.location_hidden_by_proxy ? 'Hidden' : last.location ?? 'Unknown';
  const whereSub = last.location_hidden_by_proxy ? `${CHANNEL[last.channel]}, behind a proxy` : `${CHANNEL[last.channel]}, ${away}`;

  const facts: { label: string; value: string; sub: string; flag?: boolean }[] = [
    {
      label: n > 1 ? 'Amount approved' : 'Amount',
      value: money(total),
      sub: n > 1 ? `${n} charges, ${declined ? `${declined} declined` : 'all approved'}` : times && times >= 2 ? `${times}× their usual ${money(avg)}` : `Usual purchase ${money(avg)}`,
      flag: !!times && times >= 3,
    },
    { label: 'When', value: when, sub: whenSub, flag: last.hour_of_day < 6 },
    { label: 'Where', value: where, sub: whereSub, flag: last.location_hidden_by_proxy || last.distance_from_home_miles > 100 },
    last.channel === 'transfer'
      ? { label: 'Sent to', value: last.payee ?? 'Unknown payee', sub: last.device ? `From ${deviceName(last.device.label)}${last.device.first_seen_today ? ', new that day' : ''}` : 'Transfer', flag: !!last.device?.first_seen_today }
      : last.device
        ? { label: 'Device', value: last.device.label, sub: last.device.first_seen_today ? 'First seen that day' : `Known since ${last.device.first_seen.slice(0, 4)}`, flag: last.device.first_seen_today }
        : { label: 'How', value: last.channel === 'atm' ? 'Card and PIN' : 'Card present', sub: 'Used in person' },
  ];

  return (
    <section className="keyfacts" aria-label="The activity">
      {facts.map((f) => (
        <div key={f.label} className={f.flag ? 'flag' : ''}>
          <span className="kf-label">{f.label}</span>
          <span className="kf-value">{f.value}</span>
          <span className="kf-sub">{f.flag && <i title="Unusual for this customer" />}{f.sub}</span>
        </div>
      ))}
    </section>
  );
}
