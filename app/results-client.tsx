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

  const source = shown
    ? `${shown.kind === 'official' ? 'Official run' : 'Your live run, kept in this browser tab only'}, ${new Date(shown.run_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ${complete.length} of ${alerts.length} alerts, with Jev (${shown.settings.jevModel}) and ${shown.settings.openaiModel}.`
    : '';

  return (
    <>
      <p className="kicker">The test behind Tidey</p>
      <h1>How well does Tidey decide?</h1>
      <p className="lead">
        Tidey runs on Jev plus plain code rules. To test that design, the same agent was also built the obvious way, with one AI model deciding everything.
        Both versions ran on the same alerts and were scored against an answer key neither one sees. Analysts only use Tidey; the second version exists for this test.
      </p>

      <div className="results-intro">
        {complete.length > 0 ? (
          <>
            <p className="result-line">{headline(sj, sl)}</p>
            <div className="source-row">
              <p className="source">{source}{shown?.mock ? ' Mock mode: these are stand-in answers, not real results.' : ''}</p>
              {official && live && (
                <div className="seg" role="group" aria-label="Which run to show">
                  <button className={view === 'official' ? 'on' : ''} aria-pressed={view === 'official'} onClick={() => setView('official')}>Official run</button>
                  <button className={view === 'live' ? 'on' : ''} aria-pressed={view === 'live'} onClick={() => setView('live')}>Your live run</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="result-line quiet">No results yet. <a href="#run">Run the five sample alerts</a> to watch both versions work.</p>
        )}
      </div>

      {complete.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Head to head</h2>
            <p>Same alerts, same checks and the same ${settings.maxAutoCloseAmount.toLocaleString()} limit on closing an alert alone. On each measure, the better result is marked.</p>
          </div>
          <Scoreboard a={sj} b={sl} />
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Every alert</h2>
          <p>Open any alert to see how each version investigated it and what the answer key says.</p>
        </div>
        <div className="wide tablewrap">
          <table className="list">
            <thead>
              <tr><th>Alert</th><th>What happened</th><th className="num">Amount</th><th>Tidey</th><th>One AI model</th><th>Right answer</th></tr>
            </thead>
            <tbody>
              {alerts.map((a) => {
                const p = byId.get(a.id);
                const right = isOk(p?.jev) ? p!.jev : isOk(p?.llm) ? p!.llm : null;
                return (
                  <tr key={a.id} className="click" onClick={() => (window.location.href = `/cases/${a.id}?from=proof&run=${shown?.kind ?? 'official'}`)}>
                    <td><a href={`/cases/${a.id}?from=proof&run=${shown?.kind ?? 'official'}`} onClick={(e) => e.stopPropagation()}>{a.id}</a>{featured.includes(a.id) && <span className="tag">Sample</span>}</td>
                    <td>{a.what_happened}</td>
                    <td className="num">{money(a.amount)}</td>
                    <td><Cell r={p?.jev} /></td>
                    <td><Cell r={p?.llm} /></td>
                    <td>{right ? ANSWER_LABEL[right.score.label] : <span className="muted">Not run</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" id="run">
        <div className="section-head">
          <h2>Run the test yourself</h2>
          <p>Both versions run side by side on real Jev and OpenAI calls, and the tables above fill in as each alert finishes. A live run stays in this browser tab.</p>
        </div>
        <div className="runbox">
          <div className="run-opt">
            <h3>Five sample alerts</h3>
            <p>Open to anyone. A mix of fraud, false alarms and judgment calls. Takes about a minute.</p>
            <button className="btn primary" disabled={busy} onClick={() => start(featured, pass)}>Run the sample alerts</button>
          </div>
          <div className="run-opt">
            <h3>All {alerts.length} alerts</h3>
            <p>For the owner. Needs the passcode, because every run costs API credits.</p>
            <div className="row">
              <input className="pass" type="password" placeholder="Owner passcode" aria-label="Owner passcode" value={pass} onChange={(e) => setPass(e.target.value)} />
              <button className="btn" disabled={busy || !pass} onClick={() => start(alerts.map((a) => a.id), pass)}>Run all {alerts.length}</button>
            </div>
          </div>
          {(busy || msg || (live && !busy)) && (
            <div className="run-status">
              {busy && (
                <>
                  <div className="progress"><b style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} /></div>
                  <p className="small muted">Running {progress.done} of {progress.total} alerts through both versions…</p>
                </>
              )}
              {msg && <p className="small no">{msg}</p>}
              {live && !busy && (
                <div className="row">
                  {failed.length > 0 && <button className="btn" onClick={() => start(failed, pass, live)}>Retry {failed.length} failed</button>}
                  <button className="btn" onClick={download}>Download your live run</button>
                  <span className="small muted">To publish it as the official run, add the file to <code>public/results/official.json</code> in the repo.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// One plain sentence pair, built from the numbers, that leads the page.
function headline(a: RunSummary, b: RunSummary) {
  const fraud = (n: number) => (n === 0 ? 'no fraud' : `${n} ${n === 1 ? 'fraud' : 'frauds'}`);
  return (
    <>
      Tidey made the right call on <b>{a.correct} of {a.alerts}</b> alerts, compared with <b>{b.correct}</b> for one AI model doing everything. It closed{' '}
      <b>{fraud(a.missedFraud)}</b> with nobody looking; the single model closed <b>{fraud(b.missedFraud)}</b>.
    </>
  );
}

function Cell({ r }: { r?: RunResult | { error: string } }) {
  if (!r) return <span className="pill none">Not run</span>;
  if (!isOk(r)) return <span className="pill err" title={r.error}>Error</span>;
  const d = r.trace.decision;
  return (
    <span className="cell">
      <span className={`pill ${d.action}`}>{actionText(d.action, d.verdict)}</span>
      {r.score.correct ? <span className="ok" aria-label="correct">✓</span> : <span className="no" aria-label="wrong">✗</span>}
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
    <div className="wide tablewrap">
      <table className="score" style={{ minWidth: 600 }}>
        <thead><tr><th style={{ width: '38%' }}>Measure</th><th className="j">Tidey<span className="sub">Jev decides, code acts</span></th><th>One AI model<span className="sub">Does everything, as a baseline</span></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td className="k">{r.k}{r.sub && <span className="sub">{r.sub}</span>}</td>
              <td className="j">{r.av}{r.better === 'a' && <span className="better">better</span>}</td>
              <td>{r.bv}{r.better === 'b' && <span className="better">better</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
