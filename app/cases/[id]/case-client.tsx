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
  const view = from === 'proof' ? null : isAction(viewParam) ? viewParam : pair && isOk(pair.jev) ? pair.jev.trace.decision.action : null;
  const list = (run?.results ?? []).filter((p) => (from === 'proof' ? true : view && isOk(p.jev) && p.jev.trace.decision.action === view)).map((p) => p.alertId);
  const idx = list.indexOf(alert.id);
  const query = from === 'proof' ? `?from=proof&run=${run?.kind ?? 'official'}` : view ? `?view=${view}` : '';
  const caseHref = (id?: string) => (id ? `/cases/${id}${query}` : undefined);
  const prev = caseHref(list[idx - 1]);
  const next = caseHref(list[idx + 1]);
  const back = from === 'proof' ? { href: '/proof', label: 'Back to test results' } : { href: !view || view === 'escalate' ? '/' : `/?view=${view}`, label: 'Back to the queue' };
  const where = from === 'proof' ? 'in the test' : GROUPS.find((g) => g.key === view)?.short ?? '';
  // After a call, "Next alert" skips to the next one nobody has decided yet.
  const open = list.filter((id) => !decisions[id]);
  const after = [...list.slice(idx + 1), ...list.slice(0, Math.max(0, idx))].find((id) => !decisions[id] && id !== alert.id);
  const decide = (d: Decided | null) => setDecisions(saveDecision(alert.id, d));
  const leftN = open.filter((id) => id !== alert.id).length;
  const leftText =
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
          verdictSlot={
            <Verdict
              r={r}
              group={pair && isOk(pair.jev) ? pair.jev.trace.decision.action : null}
              decided={decisions[alert.id]}
              onDecide={decide}
              nextOpen={caseHref(after)}
              leftText={leftText}
              back={back}
            />
          }
        />
      )}
    </>
  );
}

type VerdictProps = {
  r: RunResult;
  group: Action | null;
  decided?: Decided;
  onDecide: (d: Decided | null) => void;
  nextOpen?: string;
  leftText: string;
  back: { href: string; label: string };
};

const WORK_MS = 1100;
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// Tidey's call, the analyst's buttons, and what happens after a click: Tidey does the work, then the whole card turns into the result.
function Verdict({ r, group, decided, onDecide, nextOpen, leftText, back }: VerdictProps) {
  const d = r.trace.decision;
  const tidey = r.trace.mode === 'jev';
  const who = tidey ? 'Tidey' : 'The baseline';
  const [working, setWorking] = useState<Choice | null>(null);
  const rec = r.trace.summary?.recommendation;

  let title = '', body = '';
  if (d.action === 'close') {
    title = `${who} closed this as a false alarm`;
    body = tidey ? `${closedReason(r)}.` : 'The model judged it legitimate.';
  } else if (d.action === 'escalate') {
    title = `${who} found ${FOUND[d.verdict] ?? VERDICT_LABEL[d.verdict].toLowerCase()}`;
    body = rec || 'Recommends blocking the card or holding the transfer.';
  } else {
    title = `${who} needs your call`;
    body = rec || firstSentence(d.reason);
  }

  const act = (c: Choice) => {
    setWorking(c);
    window.setTimeout(() => {
      onDecide({ choice: c, at: new Date().toISOString() });
      setWorking(null);
    }, WORK_MS);
  };

  // The analyst's calls belong to Tidey's view; the baseline is shown for the test only.
  if (tidey && decided && !working && group) {
    const o = outcome(decided.choice, d.verdict);
    return (
      <div className={`verdict resolved ${o.state}`} role="status">
        <div className="res-main">
          <span className="resolved-mark"><StateIcon state={o.state} size={22} /></span>
          <div className="res-text">
            <div className="res-title">
              <h2>{o.title}</h2>
              <span className="demo-tag" title="Nothing real was blocked, sent or saved outside this browser tab">Demo</span>
            </div>
            <p>{o.body}</p>
          </div>
          <span className="res-time">{clockTime(decided.at)}</span>
        </div>
        <div className="res-foot">
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
    <div className={`verdict ${d.action}${working ? ' working' : ''}`}>
      <div className="verdict-say">
        {tidey && <TideyBadge size={38} live={!!working} />}
        <div>
          <p className={`status ${d.action}`}>
            <i className={d.action === 'close' || !tidey ? '' : 'pulsing'} />
            {!tidey ? 'Baseline decision, for the test only' : d.action === 'close' ? 'Closed by Tidey' : STATUS[d.action]}
          </p>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
      </div>
      {tidey && group && (
        <div className="acts">
          {o ? (
            <span className="working-note" role="status"><span className="spinner" aria-hidden="true" />{o.working}</span>
          ) : (
            CHOICES[group].map((a) => <button key={a.choice} className={a.cls} onClick={() => act(a.choice)}>{a.label}</button>)
          )}
        </div>
      )}
    </div>
  );
}

function CaseView({ r, verdictSlot }: { r: RunResult; verdictSlot: React.ReactNode }) {
  const t = r.trace;
  const ctx = t.steps[0]?.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const item = ctx?.triggering_activity?.[ctx.triggering_activity.length - 1];
  const decide = t.steps.find((s) => s.kind === 'decide');
  const rule = t.steps.find((s) => s.kind === 'rule');

  return (
    <>
      {verdictSlot}
      <div className="case-grid">
        <div className="stack">
          {t.summary && (
            <section className="panel">
              <p className="label">What {t.mode === 'jev' ? 'Tidey' : 'the baseline'} found</p>
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
            <p className="label">The alert</p>
            <dl className="facts">
              <dt>Customer</dt><dd>{ctx?.customer?.name}, since {ctx?.customer?.customer_since?.slice(0, 4)}</dd>
              <dt>Home</dt><dd>{ctx?.customer?.home_city}</dd>
              <dt>Account</dt><dd>{ctx?.customer?.account_type}</dd>
              <dt>Usual purchase</dt><dd>{money(ctx?.customer_average_purchase_90d ?? 0)}</dd>
              {item && <><dt>When</dt><dd>{item.time}</dd></>}
              {item && <><dt>Where</dt><dd>{item.location ?? '—'}{item.distance_from_home_miles ? `, ${item.distance_from_home_miles.toLocaleString()} miles from home` : ''}</dd></>}
              {item?.device && <><dt>Device</dt><dd>{item.device.label}{item.device.first_seen_today ? ', first seen today' : ''}</dd></>}
              {ctx?.triggering_activity?.length > 1 && <><dt>Charges</dt><dd>{ctx.triggering_activity.length}{ctx.declined_count ? `, ${ctx.declined_count} declined` : ''}</dd></>}
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
