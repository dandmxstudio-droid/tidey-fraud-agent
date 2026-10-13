'use client';
import { useEffect, useState } from 'react';
import { ANSWER_LABEL, VERDICT_LABEL, actionText, money, secs, usd } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, runOne, saveLive, type Pair, type RunFile } from '@/lib/store';
import type { RunResult, Step, Verdict } from '@/lib/types';

type A = { id: string; what_happened: string; amount: number; rule_triggered: string };

export function CaseClient({ alert, featured }: { alert: A; featured: boolean }) {
  const [pair, setPair] = useState<Pair | null>(null);
  const [source, setSource] = useState<string>('');
  const [mode, setMode] = useState<'jev' | 'llm'>('jev');
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    const live = loadLive();
    const p = live?.results.find((r) => r.alertId === alert.id);
    if (p) { setPair(p); setSource('Live run (this browser)'); return; }
    loadOfficial().then((o) => {
      const q = o?.results.find((r) => r.alertId === alert.id);
      if (q) { setPair(q); setSource('Official run'); }
    });
  }, [alert.id]);

  async function runThis() {
    setBusy(true); setErr('');
    const [jev, llm] = await Promise.all([runOne(alert.id, 'jev', pass), runOne(alert.id, 'llm', pass)]);
    const p: Pair = { alertId: alert.id, jev, llm };
    if (!isOk(jev) && !isOk(llm)) setErr((jev as { error: string }).error);
    setPair(p); setSource('Live run (this browser)');
    const live: RunFile = loadLive() ?? { kind: 'live', run_at: new Date().toISOString(), mock: (isOk(jev) && jev.trace.mock) || false, settings: { closeAt: 0, unexplainedMax: 0, escalateAt: 0, scamRiskAt: 0, maxAutoCloseAmount: 0, checkAt: 0, jevModel: isOk(jev) ? jev.trace.models.jev ?? '' : '', openaiModel: isOk(llm) ? llm.trace.models.openai ?? '' : '' }, results: [] };
    live.results = [...live.results.filter((r) => r.alertId !== alert.id), p];
    saveLive(live);
    setBusy(false);
  }

  const r = pair ? (mode === 'jev' ? pair.jev : pair.llm) : undefined;

  return (
    <>
      <a href="/" className="small muted">← All alerts</a>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <div>
          <div className="eb">Alert {alert.id} · {alert.rule_triggered}</div>
          <h1>{alert.what_happened}</h1>
          {source && <div className="small muted">{source}</div>}
        </div>
        <div className="seg">
          <button className={mode === 'jev' ? 'on' : ''} onClick={() => setMode('jev')}>A · Jev + code</button>
          <button className={mode === 'llm' ? 'on' : ''} onClick={() => setMode('llm')}>B · One AI model</button>
        </div>
      </div>

      {!pair && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ marginTop: 0 }}>This alert hasn&apos;t been run yet.</p>
          <div className="row">
            {!featured && <input className="pass" type="password" placeholder="Owner passcode" value={pass} onChange={(e) => setPass(e.target.value)} />}
            <button className="btn primary" disabled={busy || (!featured && !pass)} onClick={runThis}>{busy ? 'Running…' : 'Run this alert through both versions'}</button>
          </div>
          {err && <div className="small no" style={{ marginTop: 8 }}>{err}</div>}
        </div>
      )}

      {r && !isOk(r) && <div className="card" style={{ marginTop: 16 }}><b>This version failed:</b> {r.error}</div>}
      {r && isOk(r) && <CaseView r={r} />}
    </>
  );
}

function CaseView({ r }: { r: RunResult }) {
  const t = r.trace;
  const ctx = t.steps[0]?.data as any;
  const item = ctx?.triggering_activity?.[ctx.triggering_activity.length - 1];
  const checks = t.steps.filter((s) => s.kind === 'tool' || s.kind === 'model' || s.kind === 'plan');
  const ruleStep = t.steps.find((s) => s.kind === 'rule');
  const gate = t.decision.action === 'close' ? 'gate green' : t.decision.action === 'escalate' ? 'gate red' : 'gate';
  const [said, setSaid] = useState('');

  return (
    <div className="grid2" style={{ marginTop: 16 }}>
      <div>
        <div className="card">
          <div className="eb">The alert</div>
          <h2 style={{ margin: '6px 0 10px' }}>{ctx?.what_happened}</h2>
          <div className="facts">
            <div>Customer <b>{ctx?.customer?.name}</b></div>
            <div>Home <b>{ctx?.customer?.home_city}</b></div>
            <div>Customer since <b>{ctx?.customer?.customer_since?.slice(0, 4)}</b></div>
            <div>Usual purchase <b>{money(ctx?.customer_average_purchase_90d ?? 0)}</b></div>
            {item && <div>When <b>{item.time}</b></div>}
            {item && <div>Where <b>{item.location ?? '—'}</b>{item.distance_from_home_miles ? ` (${item.distance_from_home_miles.toLocaleString()} mi from home)` : ''}</div>}
            {item?.device && <div>Device <b>{item.device.label}</b>{item.device.first_seen_today ? ' (first seen today)' : ''}</div>}
            {ctx?.triggering_activity?.length > 1 && <div>Items <b>{ctx.triggering_activity.length}</b>{ctx.declined_count ? `, ${ctx.declined_count} declined` : ''}</div>}
          </div>
        </div>

        <div className="card">
          <div className="eb">What Wes checked</div>
          <ul className="steps" style={{ marginTop: 8 }}>
            {checks.map((s, i) => (
              <li key={i}>
                <div className="sh"><span><span className="n">{i + 1}</span>{s.label}</span>{s.ms !== undefined && <span className="small muted">{secs(s.ms)}</span>}</div>
                {s.detail && <div className="small muted" style={{ marginLeft: 28 }}>{s.detail}</div>}
                {s.kind === 'plan' && <PlanBars data={s.data as Record<string, number | null>} />}
                {s.data !== undefined && s.kind !== 'plan' && (
                  <details style={{ marginLeft: 28 }}><summary>See what it returned</summary><pre className="json">{JSON.stringify(s.data, null, 2)}</pre></details>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="card">
          {t.mode === 'jev' ? <JevDecision step={t.steps.find((s) => s.kind === 'decide')} ms={t.steps.find((s) => s.kind === 'decide')?.ms} /> : <LlmDecision r={r} />}
          <div className={gate} style={{ marginTop: 12 }}>
            <b>{actionText(t.decision.action, t.decision.verdict)}.</b> {ruleStep?.detail}
          </div>
        </div>

        {t.summary && (
          <div className="card">
            <div className="eb">Summary for the analyst <span className="tag">AI MODEL</span></div>
            <p className="sum">{t.summary.text}</p>
            {t.summary.recommendation && <p className="sum"><b>Recommendation:</b> {t.summary.recommendation}</p>}
            <div className="row">
              <button className="btn dark" onClick={() => setSaid('Approved')}>Approve</button>
              <button className="btn" onClick={() => setSaid('Overridden')}>Override</button>
              <button className="btn" onClick={() => setSaid('Asked for more info')}>Ask for more info</button>
              {said && <span className="small muted">{said} (demo only, nothing is saved)</span>}
            </div>
          </div>
        )}

        <div className="card">
          <div className="eb">Answer key</div>
          <div className="answer" style={{ marginTop: 8 }}>
            <b>{ANSWER_LABEL[r.score.label]}</b> {r.score.correct ? <span className="ok">· this version got it right ✓</span> : <span className="no">· this version got it wrong ✗</span>}
            <div className="small muted" style={{ marginTop: 4 }}>{r.score.why}</div>
          </div>
          <div className="small muted" style={{ marginTop: 12 }}>
            Time to decision {secs(t.decisionMs)} · total {secs(t.totalMs)} · cost {usd(t.costUsd)} · checks run {t.toolsUsed.length}
            {t.models.jev && <> · {t.models.jev}</>}{t.models.openai && <> · {t.models.openai}</>}{t.mock && <> · MOCK</>}
          </div>
        </div>
      </div>
    </div>
  );
}

const TOOL_TITLE: Record<string, string> = {
  devices_and_signins: 'Devices and sign-ins', account_changes: 'Account changes', prior_alerts: 'Past alerts', merchant_profile: 'Merchant check', payee_details: 'Payee check', transaction_history: 'Transaction history',
};

function PlanBars({ data }: { data: Record<string, number | null> }) {
  return (
    <div style={{ marginLeft: 28, marginTop: 6 }}>
      {Object.entries(data).map(([k, v]) => (
        <div className="opt" key={k}><span className="small">{TOOL_TITLE[k] ?? k}</span><div className={`track ${(v ?? 0) < 0.5 ? 'amber' : ''}`}><b style={{ width: `${(v ?? 0) * 100}%` }} /></div><span className="small">{(v ?? 0).toFixed(2)}</span></div>
      ))}
    </div>
  );
}

function JevDecision({ step, ms }: { step?: Step; ms?: number }) {
  const d = (step?.data ?? {}) as { verdict?: Record<string, number>; unexplained?: number; scam_risk?: number };
  const verdict = Object.entries(d.verdict ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="eb">Jev&apos;s decisions <span className="tag jev">JEV{ms !== undefined ? ` · ${secs(ms)}` : ''}</span></div>
      <div className="q" style={{ marginTop: 10 }}>
        <div className="qt">Who most likely did this?<span>pick one</span></div>
        {verdict.map(([k, v]) => <Bar key={k} label={VERDICT_LABEL[k as Verdict] ?? k} v={v} />)}
      </div>
      <div className="q">
        <div className="qt">Is anything out of character that the evidence doesn&apos;t explain?<span>yes / no</span></div>
        <Bar label="Yes" v={d.unexplained ?? 0} amber />
      </div>
      <div className="q">
        <div className="qt">Could the customer be the victim of a scam?<span>yes / no</span></div>
        <Bar label="Yes" v={d.scam_risk ?? 0} amber />
      </div>
    </>
  );
}

function LlmDecision({ r }: { r: RunResult }) {
  const d = r.trace.decision;
  return (
    <>
      <div className="eb">AI model&apos;s decision <span className="tag">ONE MODEL · {secs(r.trace.decisionMs)}</span></div>
      <div className="q" style={{ marginTop: 10 }}>
        <div className="qt">Verdict<span>chosen by the model</span></div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{VERDICT_LABEL[d.verdict]}</div>
      </div>
      <div className="q">
        <div className="qt">Confidence<span>self-reported</span></div>
        <Bar label="Confidence" v={d.confidence} />
      </div>
      {r.trace.invalidOutput && <div className="gate red">The model&apos;s answer was missing or invalid{r.trace.error ? `: ${r.trace.error}` : ''}.</div>}
    </>
  );
}

function Bar({ label, v, amber }: { label: string; v: number; amber?: boolean }) {
  return (
    <div className="opt"><span>{label}</span><div className={`track ${amber ? 'amber' : ''}`}><b style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} /></div><span>{v.toFixed(2)}</span></div>
  );
}
