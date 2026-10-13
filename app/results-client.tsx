'use client';
import { useEffect, useMemo, useState } from 'react';
import { ANSWER_LABEL, actionText, money, secs, usd } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, runOne, saveLive, type Pair, type RunFile, type Settings } from '@/lib/store';
import { summarizeRun, type RunSummary } from '@/lib/summary';
import type { RunResult } from '@/lib/types';

type AlertRow = { id: string; what_happened: string; amount: number; rule_triggered: string };

export function ResultsClient({ alerts, featured, settings, mock }: { alerts: AlertRow[]; featured: string[]; settings: Settings; mock: boolean }) {
  const [official, setOfficial] = useState<RunFile | null>(null);
  const [live, setLive] = useState<RunFile | null>(null);
  const [view, setView] = useState<'official' | 'live'>('official');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const l = loadLive();
    if (l) { setLive(l); setView('live'); }
    loadOfficial().then((o) => { setOfficial(o); if (!l && o) setView('official'); });
  }, []);

  const run = view === 'live' ? live : official ?? live;
  const shown = run ?? null;

  async function start(ids: string[], passcode: string, base?: RunFile) {
    setBusy(true); setMsg('');
    const results = new Map<string, Pair>((base?.results ?? []).map((p) => [p.alertId, p]));
    let done = 0;
    setProgress({ done, total: ids.length });
    const file = (): RunFile => ({ kind: 'live', run_at: new Date().toISOString(), mock, settings, results: alerts.filter((a) => results.has(a.id)).map((a) => results.get(a.id)!) });
    const queue = [...ids];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!;
        const [jev, llm] = await Promise.all([runOne(id, 'jev', passcode), runOne(id, 'llm', passcode)]);
        results.set(id, { alertId: id, jev, llm });
        done++;
        setProgress({ done, total: ids.length });
        const f = file();
        setLive(f); setView('live');
        if ('error' in jev && /passcode|sample/i.test(jev.error)) { queue.length = 0; setMsg(jev.error); }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    const f = file();
    const errs = f.results.flatMap((p) => [p.jev, p.llm]).filter((r) => r && !isOk(r)) as { error: string }[];
    if (errs.length) setMsg(`${errs.length} runs failed. First error: ${errs[0].error.slice(0, 200)}`);
    saveLive(f); setLive(f); setBusy(false);
  }

  const failed = (live?.results ?? []).filter((p) => !isOk(p.jev) || !isOk(p.llm)).map((p) => p.alertId);

  function download() {
    if (!live) return;
    const blob = new Blob([JSON.stringify({ ...live, kind: 'official' }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'official.json';
    a.click();
  }

  const pairs = shown?.results ?? [];
  const complete = pairs.filter((p) => isOk(p.jev) && isOk(p.llm));
  const sj = useMemo(() => summarizeRun(complete.map((p) => p.jev as RunResult)), [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const sl = useMemo(() => summarizeRun(complete.map((p) => p.llm as RunResult)), [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map(pairs.map((p) => [p.alertId, p]));

  return (
    <>
      <div className="eb">Wes · agent test · 50 synthetic fraud alerts</div>
      <h1>Wes, built two ways</h1>
      <p className="lead">
        Wes is a fraud alert agent. It investigates each alert with the same checks either way. In version A, <b>Jev</b> answers typed questions with probabilities and plain <b>code rules</b> decide
        what happens. In version B, <b>one AI model</b> picks the checks and decides everything. Both are scored against an answer key neither one sees.
      </p>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={() => start(featured, pass)}>Run the 5 sample alerts live</button>
            <span className="muted small">or</span>
            <input className="pass" type="password" placeholder="Owner passcode" value={pass} onChange={(e) => setPass(e.target.value)} />
            <button className="btn dark" disabled={busy || !pass} onClick={() => start(alerts.map((a) => a.id), pass)}>Run all 50</button>
            {!busy && failed.length > 0 && <button className="btn" onClick={() => start(failed, pass, live!)}>Retry {failed.length} failed</button>}
          </div>
          <div className="row">
            {official && live && (
              <div className="seg">
                <button className={view === 'official' ? 'on' : ''} onClick={() => setView('official')}>Official run</button>
                <button className={view === 'live' ? 'on' : ''} onClick={() => setView('live')}>Your live run</button>
              </div>
            )}
            {live && !busy && view === 'live' && <button className="btn" onClick={download}>Download results</button>}
          </div>
        </div>
        {busy && (
          <>
            <div className="progress"><b style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} /></div>
            <div className="small muted" style={{ marginTop: 6 }}>Running {progress.done} of {progress.total} alerts through both versions…</div>
          </>
        )}
        {msg && <div className="small no" style={{ marginTop: 8 }}>{msg}</div>}
        <div className="small muted" style={{ marginTop: 10 }}>
          {shown
            ? <>Showing: <b>{shown.kind === 'official' ? 'Official run' : 'Live run (this browser only)'}</b> · {new Date(shown.run_at).toLocaleString()} · {complete.length} of {alerts.length} alerts · Jev model {shown.settings.jevModel}, AI model {shown.settings.openaiModel}{shown.mock ? ' · MOCK MODE (not real results)' : ''}</>
            : <>No results yet. Run the sample alerts to watch both versions work.</>}
        </div>
      </div>

      {complete.length > 0 && <Scoreboard a={sj} b={sl} />}

      <div className="card">
        <h2>Every alert</h2>
        <div className="tablewrap">
        <table className="list">
          <thead>
            <tr><th>Alert</th><th>What happened</th><th>Amount</th><th>A · Jev + code</th><th>B · One AI model</th><th>Right answer</th></tr>
          </thead>
          <tbody>
            {alerts.map((a) => {
              const p = byId.get(a.id);
              const right = isOk(p?.jev) ? p!.jev : isOk(p?.llm) ? p!.llm : null;
              return (
                <tr key={a.id} className="click" onClick={() => (window.location.href = `/cases/${a.id}`)}>
                  <td>{a.id} {featured.includes(a.id) && <span className="tag">SAMPLE</span>}</td>
                  <td>{a.what_happened}</td>
                  <td>{money(a.amount)}</td>
                  <td><Cell r={p?.jev} /></td>
                  <td><Cell r={p?.llm} /></td>
                  <td>{right ? ANSWER_LABEL[right.score.label] : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {live && view === 'live' && !busy && (
        <p className="small muted">To publish this run as the official results, download it and add the file to <code>public/results/official.json</code> in the GitHub repo.</p>
      )}
    </>
  );
}

function Cell({ r }: { r?: RunResult | { error: string } }) {
  if (!r) return <span className="pill none">Not run</span>;
  if (!isOk(r)) return <span className="pill err" title={r.error}>Error</span>;
  const d = r.trace.decision;
  return (
    <span>
      <span className={`pill ${d.action}`}>{actionText(d.action, d.verdict)}</span>{' '}
      {r.score.correct ? <span className="ok">✓</span> : <span className="no">✗</span>}
    </span>
  );
}

function Scoreboard({ a, b }: { a: RunSummary; b: RunSummary }) {
  const rows: { k: string; sub?: string; av: string; bv: string; better?: 'a' | 'b' }[] = [];
  const cmp = (x: number, y: number, lower = false) => (x === y ? undefined : (lower ? x < y : x > y) ? 'a' : 'b');
  rows.push({ k: 'Correct decisions', av: `${a.correct} / ${a.alerts}`, bv: `${b.correct} / ${b.alerts}`, better: cmp(a.correct, b.correct) });
  rows.push({ k: 'Fraud closed with no person looking', sub: 'The costly mistake. Lower is better.', av: `${a.missedFraud}`, bv: `${b.missedFraud}`, better: cmp(a.missedFraud, b.missedFraud, true) });
  rows.push({ k: 'Unclear cases a person saw', av: `${a.unclearSentToPerson} / ${a.unclearTotal}`, bv: `${b.unclearSentToPerson} / ${b.unclearTotal}`, better: cmp(a.unclearSentToPerson, b.unclearSentToPerson) });
  rows.push({ k: 'Legitimate alerts sent to a person', sub: 'Extra analyst work. Lower is better.', av: `${a.unnecessaryReviews}`, bv: `${b.unnecessaryReviews}`, better: cmp(a.unnecessaryReviews, b.unnecessaryReviews, true) });
  rows.push({ k: 'Right fraud type (when escalated)', av: `${a.typeCorrect} / ${a.typeTotal}`, bv: `${b.typeCorrect} / ${b.typeTotal}` });
  rows.push({ k: 'Cost per alert', sub: 'Includes the written summary', av: usd(a.avgCostUsd), bv: usd(b.avgCostUsd), better: cmp(a.avgCostUsd, b.avgCostUsd, true) });
  rows.push({ k: 'Time to a decision', av: secs(a.avgDecisionMs), bv: secs(b.avgDecisionMs), better: cmp(a.avgDecisionMs, b.avgDecisionMs, true) });
  rows.push({ k: 'Broken or invalid outputs', av: `${a.invalidOutputs}`, bv: `${b.invalidOutputs}`, better: cmp(a.invalidOutputs, b.invalidOutputs, true) });
  return (
    <div className="card">
      <h2>Head to head</h2>
      <div className="tablewrap"><table className="score" style={{ minWidth: 560 }}>
        <thead><tr><th style={{ width: '34%' }}>Measure</th><th className="j">A · Jev decides, code acts</th><th>B · One AI model does everything</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td className="k">{r.k}{r.sub && <span className="sub">{r.sub}</span>}</td>
              <td className="j">{r.av}{r.better === 'a' && <span className="better">better</span>}</td>
              <td>{r.bv}{r.better === 'b' && <span className="better">better</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
