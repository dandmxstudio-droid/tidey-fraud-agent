'use client';
import { useEffect, useState } from 'react';
import { VERDICT_LABEL, money, secs } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, type RunFile } from '@/lib/store';
import type { Action, RunResult } from '@/lib/types';

type AlertRow = { id: string; what_happened: string; amount: number; rule_triggered: string; created_at: string };
type Tab = 'analyst' | 'escalate' | 'close';

const TABS: { key: Tab; title: string; blurb: string }[] = [
  { key: 'analyst', title: 'Needs your review', blurb: 'Mixed signals. Wes explains what is unclear and suggests a next step. You decide.' },
  { key: 'escalate', title: 'Escalated: approve block', blurb: 'Wes found fraud and recommends blocking the card or holding the transfer. Nothing is blocked until you approve.' },
  { key: 'close', title: 'Closed by Wes', blurb: 'False alarms Wes closed on its own. Open any case to see what it checked and why.' },
];

export function QueueClient({ alerts, mock }: { alerts: AlertRow[]; mock: boolean }) {
  const [run, setRun] = useState<RunFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('analyst');

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
  const by = (k: Action) => rows.filter((a) => handled.get(a.id)!.trace.decision.action === k);
  const counts = { analyst: by('analyst').length, escalate: by('escalate').length, close: by('close').length };
  const avgMs = rows.length ? rows.reduce((s, a) => s + handled.get(a.id)!.trace.decisionMs, 0) / rows.length : 0;
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <>
      <div className="eb">Demo Bank · fraud alert queue · Oct 12, 2026</div>
      <h1>Good morning. Wes worked through {rows.length || 'the'} alerts overnight.</h1>
      <p className="lead">
        Each alert from the bank&apos;s fraud rules was investigated by Wes in about {avgMs ? secs(avgMs) : 'a fraction of a second'}: account history, devices, account changes, merchant and payee checks.
        It closed the clear false alarms, escalated clear fraud for your approval, and left the unclear cases for you.
      </p>

      {loaded && rows.length === 0 && (
        <div className="card">
          Wes hasn&apos;t processed any alerts yet. Run them on the <a href="/proof">Proof</a> page.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="qstats">
            {TABS.map((t) => (
              <button key={t.key} className={`qstat ${t.key} ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
                <b>{counts[t.key]}</b>
                <span>{t.title}</span>
              </button>
            ))}
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ marginBottom: 2 }}>{current.title} <span className="muted">({counts[current.key]})</span></h2>
                <div className="small muted">{current.blurb}</div>
              </div>
            </div>
            <div className="tablewrap" style={{ marginTop: 12 }}>
              <table className="list">
                <thead>
                  <tr>
                    <th>Alert</th><th>Time</th><th>What happened</th><th>Amount</th><th>{tab === 'close' ? 'Why Wes closed it' : tab === 'escalate' ? 'Wes found' : 'Wes says'}</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {by(tab).map((a) => {
                    const r = handled.get(a.id)!;
                    const d = r.trace.decision;
                    const ctx = r.trace.steps[0]?.data as { alert_time?: string } | undefined;
                    const note =
                      tab === 'escalate'
                        ? VERDICT_LABEL[d.verdict]
                        : tab === 'close'
                          ? 'Fits normal behavior or the evidence explains it'
                          : r.trace.summary?.recommendation || (d.verdict === 'legitimate' ? 'Leans legitimate, needs a check' : `Possible ${VERDICT_LABEL[d.verdict].toLowerCase()}`);
                    return (
                      <tr key={a.id} className="click" onClick={() => (window.location.href = `/cases/${a.id}`)}>
                        <td>{a.id}</td>
                        <td className="small">{(ctx?.alert_time ?? a.created_at).slice(11, 16)}</td>
                        <td>{a.what_happened}</td>
                        <td>{money(a.amount)}</td>
                        <td className="small">{note}</td>
                        <td>
                          {tab === 'close' && <span className="pill close">Closed</span>}
                          {tab === 'escalate' && <span className="pill escalate">Awaiting approval</span>}
                          {tab === 'analyst' && <span className="pill analyst">Open</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="small muted">
            {run?.kind === 'official' ? 'Showing the official test run.' : 'Showing your latest live run.'} All customers and alerts are synthetic.
            {mock || run?.mock ? ' Mock mode: decisions come from stand-in rules, not Jev.' : ''} See how Wes scored against the answer key on the <a href="/proof">Proof</a> page.
          </p>
        </>
      )}
    </>
  );
}
