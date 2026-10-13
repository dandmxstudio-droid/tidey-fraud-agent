'use client';
import { useEffect, useState } from 'react';
import { closedReason, firstSentence } from '@/lib/headlines';
import { GROUPS, VERDICT_LABEL, isAction, money, secs } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, type RunFile } from '@/lib/store';
import type { Action, RunResult } from '@/lib/types';

type AlertRow = { id: string; what_happened: string; amount: number; rule_triggered: string; created_at: string };

export function QueueClient({ alerts, mock }: { alerts: AlertRow[]; mock: boolean }) {
  const [run, setRun] = useState<RunFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Action>('analyst');

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (isAction(v)) setTab(v);
    const live = loadLive();
    loadOfficial().then((o) => {
      setRun(o ?? live);
      setLoaded(true);
    });
  }, []);

  const handled = new Map<string, RunResult>();
  for (const p of run?.results ?? []) if (isOk(p.jev)) handled.set(p.alertId, p.jev);
  const rows = alerts.filter((a) => handled.has(a.id));
  const of = (k: Action) => rows.filter((a) => handled.get(a.id)!.trace.decision.action === k);
  const count = (k: Action) => of(k).length;
  const avgMs = rows.length ? rows.reduce((s, a) => s + handled.get(a.id)!.trace.decisionMs, 0) / rows.length : 0;
  const group = GROUPS.find((g) => g.key === tab)!;
  // Keep the open group in the URL, so coming back from a case lands on the same group.
  const pick = (k: Action) => {
    setTab(k);
    window.history.replaceState(null, '', k === 'analyst' ? '/' : `/?view=${k}`);
  };
  const toHandle = count('analyst') + count('escalate');

  const take = (r: RunResult) => {
    const d = r.trace.decision;
    if (d.action === 'close') return closedReason(r);
    if (d.action === 'escalate') return `${VERDICT_LABEL[d.verdict]}. ${firstSentence(r.trace.summary?.recommendation) || 'Recommends a block.'}`;
    return firstSentence(r.trace.summary?.recommendation) || (d.verdict === 'legitimate' ? 'Probably fine, but something doesn’t add up.' : `Possible ${VERDICT_LABEL[d.verdict].toLowerCase()}.`);
  };

  return (
    <>
      <p className="kicker">Fraud operations, Tuesday October 13</p>
      <h1>{rows.length ? `${toHandle} of yesterday’s ${rows.length} alerts need you.` : 'Yesterday’s alerts'}</h1>
      <p className="lead">
        Tidey investigated every alert the bank’s fraud rules raised yesterday, in about {avgMs ? secs(avgMs) : 'a fraction of a second'} each. It closed the clear false alarms,
        lined up clear fraud for your approval, and left the judgment calls to you.
      </p>

      {loaded && rows.length === 0 && (
        <div className="panel">No alerts have been investigated yet. Run them from the <a href="/proof">Test results</a> page.</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="tideline" aria-hidden="true">
            <div className="bar">
              {GROUPS.map((g) => <i key={g.key} className={g.key} style={{ width: `${(100 * count(g.key)) / rows.length}%` }} />)}
            </div>
          </div>

          <div className="qtabs" role="tablist" aria-label="Alert groups">
            {GROUPS.map((g) => (
              <button key={g.key} role="tab" id={`tab-${g.key}`} aria-selected={tab === g.key} aria-controls="inbox" className={`qtab ${g.key}`} onClick={() => pick(g.key)}>
                <span className="qtab-label"><i className={`dot-${g.key}`} />{g.label}</span>
                <b>{count(g.key)}</b>
              </button>
            ))}
          </div>

          <section className="inbox" id="inbox" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            <div className="inbox-head">
              <h2>{group.title}</h2>
              <p>{group.blurb}</p>
            </div>
            {of(tab).map((a) => {
              const r = handled.get(a.id)!;
              const ctx = r.trace.steps[0]?.data as { alert_time?: string } | undefined;
              return (
                <a key={a.id} className="item" href={`/cases/${a.id}?view=${tab}`}>
                  <span className={`edge ${tab}`} />
                  <span>
                    <div className="what">{a.what_happened}</div>
                    <div className="take">{take(r)}</div>
                  </span>
                  <span className="meta">
                    <div className="amt">{money(a.amount)}</div>
                    <div className="when">{(ctx?.alert_time ?? a.created_at).slice(11, 16)} · {a.id}</div>
                  </span>
                </a>
              );
            })}
            {count(tab) === 0 && <div className="inbox-head"><p>Nothing here.</p></div>}
          </section>

          <p className="foot-note">
            {run?.kind === 'official' ? 'This queue shows the official test run.' : 'This queue shows your latest live run.'} Tidewell is fictional and every alert is synthetic.
            {mock || run?.mock ? ' Mock mode: decisions come from stand-in rules, not Jev.' : ''} How well Tidey sorts alerts is measured on the <a href="/proof">Test results</a> page.
          </p>
        </>
      )}
    </>
  );
}
