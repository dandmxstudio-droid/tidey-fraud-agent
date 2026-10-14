'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ANSWER_LABEL, actionText, modelName, money, secs, usd } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, type Pair, type RunFile, type Settings } from '@/lib/store';
import { summarizeRun, type RunSummary } from '@/lib/summary';
import type { RunResult } from '@/lib/types';

type AlertRow = { id: string; what_happened: string; amount: number; rule_triggered: string };

export function ResultsClient({ alerts, featured, settings, mock }: { alerts: AlertRow[]; featured: string[]; settings: Settings; mock: boolean }) {
  const [official, setOfficial] = useState<RunFile | null>(null);
  const [live, setLive] = useState<RunFile | null>(null);
  const [view, setView] = useState<'official' | 'live'>('official');

  useEffect(() => {
    const l = loadLive();
    if (l) { setLive(l); setView('live'); }
    loadOfficial().then((o) => { setOfficial(o); if (!l && o) setView('official'); });
  }, []);

  const run = view === 'live' ? live : official ?? live;
  const shown = run ?? null;

  const pairs = shown?.results ?? [];
  const complete = pairs.filter((p) => isOk(p.jev) && isOk(p.llm));
  const sj = useMemo(() => summarizeRun(complete.map((p) => p.jev as RunResult)), [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const sl = useMemo(() => summarizeRun(complete.map((p) => p.llm as RunResult)), [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map(pairs.map((p) => [p.alertId, p]));

  const source = shown
    ? `${shown.kind === 'official' ? 'Official run' : 'Your live run, kept in this browser only'}, ${new Date(shown.run_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ${complete.length} of ${alerts.length} alerts, with Jev (${shown.settings.jevModel}) and OpenAI ${modelName(shown.settings.openaiModel)}.`
    : '';

  return (
    <>
      <p className="kicker">The test behind Tidey</p>
      <h1>How well does Tidey decide?</h1>
      <p className="lead">
        Tidey runs on Jev plus plain code rules. To test that design, the same agent was also built the usual way, with a single OpenAI model ({modelName(settings.openaiModel)}, from the family behind ChatGPT) making every decision.
        Both versions ran on the same 50 alerts and were scored against an answer key neither one sees. Tidey’s rules were tuned on a separate set of alerts first, so these results aren’t flattered by tuning. Analysts only use Tidey; the second version exists for this test.
      </p>

      <section className="outcomes" aria-label="Every decision, one bar per alert">
        <div className="outcomes-head">
          <p className="outcomes-title">{shown ? <>Every decision, one bar per alert</> : <>No results yet</>}</p>
          <ul className="legend">
            <li><i className="sw close" />Closed as a false alarm</li>
            <li><i className="sw escalate" />Escalated as fraud</li>
            <li><i className="sw analyst" />Sent to a person</li>
            <li><i className="sw wrong" />Wrong call</li>
            <li><i className="sw missed" />Risky alert closed alone</li>
          </ul>
        </div>
        <OutcomeStrips key={`${view}-${shown?.run_at ?? 'none'}`} alerts={alerts} byId={byId} a={sj} b={sl} hasRun={complete.length > 0} runKind={shown?.kind ?? 'official'} model={shown?.settings.openaiModel ?? settings.openaiModel} />
        <div className="source-row">
          <p className="source">
            {shown
              ? <>{source}{shown.mock ? ' Mock mode: these are stand-in answers, not real results.' : ''}</>
              : <>Run the five sample alerts from the <a href="/#run">queue page</a> and the bars fill in here.</>}
          </p>
          {official && live && (
            <div className="seg" role="group" aria-label="Which run to show">
              <button className={view === 'official' ? 'on' : ''} aria-pressed={view === 'official'} onClick={() => setView('official')}>Official run</button>
              <button className={view === 'live' ? 'on' : ''} aria-pressed={view === 'live'} onClick={() => setView('live')}>Your live run</button>
            </div>
          )}
        </div>
      </section>

      {complete.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Head to head</h2>
            <p>Same alerts, same checks and the same ${settings.maxAutoCloseAmount.toLocaleString()} limit on closing an alert alone. On each measure, the better result is marked.</p>
          </div>
          <Scoreboard a={sj} b={sl} model={shown?.settings.openaiModel ?? settings.openaiModel} />
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
              <tr><th>Alert</th><th>What happened</th><th className="num">Amount</th><th>Tidey</th><th>One AI model ({modelName(shown?.settings.openaiModel ?? settings.openaiModel)})</th><th>Right answer</th></tr>
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

function Scoreboard({ a, b, model }: { a: RunSummary; b: RunSummary; model: string }) {
  const rows: { k: string; sub?: string; av: string; bv: string; better?: 'a' | 'b' }[] = [];
  const cmp = (x: number, y: number, lower = false) => (x === y ? undefined : (lower ? x < y : x > y) ? 'a' : 'b');
  rows.push({ k: 'Correct decisions', av: `${a.correct} / ${a.alerts}`, bv: `${b.correct} / ${b.alerts}`, better: cmp(a.correct, b.correct) });
  rows.push({ k: 'Risky alerts closed with nobody looking', sub: 'Fraud or unclear cases. The costly mistake. Lower is better.', av: `${a.missedFraud}`, bv: `${b.missedFraud}`, better: cmp(a.missedFraud, b.missedFraud, true) });
  rows.push({ k: 'Unclear cases a person saw', av: `${a.unclearSentToPerson} / ${a.unclearTotal}`, bv: `${b.unclearSentToPerson} / ${b.unclearTotal}`, better: cmp(a.unclearSentToPerson, b.unclearSentToPerson) });
  rows.push({ k: 'Legitimate alerts sent to a person', sub: 'Extra analyst work. Lower is better.', av: `${a.unnecessaryReviews}`, bv: `${b.unnecessaryReviews}`, better: cmp(a.unnecessaryReviews, b.unnecessaryReviews, true) });
  rows.push({ k: 'Right fraud type (when escalated)', av: `${a.typeCorrect} / ${a.typeTotal}`, bv: `${b.typeCorrect} / ${b.typeTotal}` });
  rows.push({ k: 'Cost per alert', sub: 'Includes the written summary', av: usd(a.avgCostUsd), bv: usd(b.avgCostUsd), better: cmp(a.avgCostUsd, b.avgCostUsd, true) });
  rows.push({ k: 'Time to a decision', av: secs(a.avgDecisionMs), bv: secs(b.avgDecisionMs), better: cmp(a.avgDecisionMs, b.avgDecisionMs, true) });
  rows.push({ k: 'Broken or invalid outputs', av: `${a.invalidOutputs}`, bv: `${b.invalidOutputs}`, better: cmp(a.invalidOutputs, b.invalidOutputs, true) });
  return (
    <div className="wide tablewrap">
      <table className="score" style={{ minWidth: 600 }}>
        <thead><tr><th style={{ width: '38%' }}>Measure</th><th className="j">Tidey<span className="sub">Jev decides, code acts</span></th><th>One AI model<span className="sub">OpenAI {modelName(model)}, doing everything</span></th></tr></thead>
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

type Bucket = 'legit' | 'fraud' | 'unclear' | 'notrun';
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'legit', label: 'Legitimate' },
  { key: 'fraud', label: 'Fraud' },
  { key: 'unclear', label: 'Unclear' },
  { key: 'notrun', label: 'Not run yet' },
];
const EXPECTED: Record<Exclude<Bucket, 'notrun'>, string> = { legit: 'close', fraud: 'escalate', unclear: 'analyst' };

// The page's main picture: alerts grouped by the right answer, one bar each, colored by what each version did.
function OutcomeStrips({ alerts, byId, a, b, hasRun, runKind, model }: { alerts: AlertRow[]; byId: Map<string, Pair>; a: RunSummary; b: RunSummary; hasRun: boolean; runKind: string; model: string }) {
  const bucketOf = (id: string): Bucket => {
    const p = byId.get(id);
    const r = isOk(p?.jev) ? p!.jev : isOk(p?.llm) ? p!.llm : null;
    if (!r) return 'notrun';
    return r.score.label === 'legitimate' ? 'legit' : r.score.label === 'unclear' ? 'unclear' : 'fraud';
  };
  const groups = BUCKETS.map((g) => ({ ...g, ids: alerts.filter((x) => bucketOf(x.id) === g.key).map((x) => x.id) })).filter((g) => g.ids.length);
  const cols = groups.map((g) => `${g.ids.length}fr`).join(' ');
  const what = new Map(alerts.map((x) => [x.id, x.what_happened]));
  const href = (id: string) => `/cases/${id}?from=proof&run=${runKind}`;
  const said = (r?: RunResult | { error: string }) => (!r ? 'not run' : !isOk(r) ? 'failed' : `${actionText(r.trace.decision.action, r.trace.decision.verdict).toLowerCase()}${r.score.correct ? ', right' : ', wrong'}`);
  const missed = (n: number) => (n === 0 ? 'No risky alert closed alone' : `${n} risky ${n === 1 ? 'alert' : 'alerts'} closed alone`);

  const rows: { name: string; note: string[]; cell: (id: string) => { cls: string; tip: string } }[] = [
    {
      name: 'The right answer',
      note: [hasRun ? 'From the answer key' : 'Revealed after a run'],
      cell: (id) => {
        const k = bucketOf(id);
        return { cls: k === 'notrun' ? 'none' : EXPECTED[k], tip: k === 'notrun' ? 'not run yet' : BUCKETS.find((x) => x.key === k)!.label.toLowerCase() };
      },
    },
    ...(['jev', 'llm'] as const).map((m) => ({
      name: m === 'jev' ? 'Tidey' : 'One AI model',
      note: [...(m === 'llm' ? [`OpenAI ${modelName(model)}`] : ['Jev plus code rules']), ...(hasRun ? [`${(m === 'jev' ? a : b).correct} of ${(m === 'jev' ? a : b).alerts} right`, missed((m === 'jev' ? a : b).missedFraud)] : ['Not run yet'])],
      cell: (id: string) => {
        const r = byId.get(id)?.[m];
        if (!r) return { cls: 'none', tip: 'not run' };
        if (!isOk(r)) return { cls: 'err', tip: 'failed' };
        return { cls: `${r.trace.decision.action}${r.score.correct ? '' : ' wrong'}${r.score.missedFraud ? ' missed' : ''}`, tip: said(r) };
      },
    })),
  ];

  let n = 0;
  return (
    <div className="strips">
      <div className="strip-row head">
        <span />
        <div className="strip" style={{ gridTemplateColumns: cols }}>
          {groups.map((g) => <span key={g.key} className="group-label"><b>{g.ids.length}</b> {g.label.toLowerCase()}</span>)}
        </div>
      </div>
      {rows.map((row, ri) => (
        <div key={row.name} className={`strip-row${ri === 1 ? ' tidey-row' : ''}`}>
          <div className="strip-name"><b>{row.name}</b>{row.note.map((t) => <span key={t}>{t}</span>)}</div>
          <div className="strip" style={{ gridTemplateColumns: cols }}>
            {groups.map((g) => (
              <div key={g.key} className="strip-group" style={{ gridTemplateColumns: `repeat(${g.ids.length}, minmax(0, 1fr))` }}>
                {g.ids.map((id, i) => {
                  const c = row.cell(id);
                  n += 1;
                  return (
                    <a key={id} href={href(id)} className={`bar-cell ${c.cls}`} title={`${id}: ${what.get(id)}. ${row.name}: ${c.tip}.`} aria-label={`${id}, ${row.name}: ${c.tip}`} style={{ '--i': n - ri * alerts.length, '--r': ri } as CSSProperties} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
