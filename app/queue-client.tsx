'use client';
import { useEffect, useState } from 'react';
import { closedReason, firstSentence } from '@/lib/headlines';
import { VERDICT_LABEL, money, secs } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, type RunFile } from '@/lib/store';
import type { Action, RunResult } from '@/lib/types';

type AlertRow = { id: string; what_happened: string; amount: number; rule_triggered: string; created_at: string };

const GROUPS: { key: Action; title: string; short: string; blurb: string }[] = [
  { key: 'analyst', title: 'Needs your call', short: 'need your call', blurb: 'Mixed signals. Tidey explains what is unclear and suggests a next step.' },
  { key: 'escalate', title: 'Fraud, waiting for your approval', short: 'fraud to approve', blurb: 'Tidey found fraud and recommends a block or hold. Nothing happens until you approve it.' },
  { key: 'close', title: 'Closed by Tidey', short: 'closed by Tidey', blurb: 'False alarms Tidey closed on its own. Every one keeps its evidence, so you can spot-check.' },
];

export function QueueClient({ alerts, mock }: { alerts: AlertRow[]; mock: boolean }) {
  const [run, setRun] = useState<RunFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Action>('analyst');

  useEffect(() => {
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
        <div className="panel">No alerts have been investigated yet. Run them from the <a href="/proof">Proof</a> page.</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="tideline" aria-label="How Tidey sorted yesterday's alerts">
            <div className="bar">
              {GROUPS.map((g) => (
                <button key={g.key} className={g.key} style={{ width: `${(100 * count(g.key)) / rows.length}%` }} onClick={() => setTab(g.key)} aria-label={`${count(g.key)} ${g.short}`} />
              ))}
            </div>
            <div className="keys">
              {GROUPS.map((g) => (
                <button key={g.key} className={`key ${tab === g.key ? 'on' : ''}`} onClick={() => setTab(g.key)}>
                  <i className={`dot-${g.key}`} />
                  <b>{count(g.key)}</b>
                  <span>{g.short}</span>
                </button>
              ))}
            </div>
          </div>

          <section className="inbox">
            <div className="inbox-head">
              <h2>{group.title}</h2>
              <p>{group.blurb}</p>
            </div>
            {of(tab).map((a) => {
              const r = handled.get(a.id)!;
              const ctx = r.trace.steps[0]?.data as { alert_time?: string } | undefined;
              return (
                <a key={a.id} className="item" href={`/cases/${a.id}`}>
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
            {mock || run?.mock ? ' Mock mode: decisions come from stand-in rules, not Jev.' : ''} How well Tidey sorts alerts is measured on the <a href="/proof">Proof</a> page.
          </p>
        </>
      )}
    </>
  );
}
