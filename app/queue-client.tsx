'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { closedReason, firstSentence } from '@/lib/headlines';
import { VERDICT_LABEL, isAction, modelName, money, secs } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, type RunFile, type Settings } from '@/lib/store';
import { RunBox } from './run-box';
import type { Action, RunResult, Verdict } from '@/lib/types';
import { loadDecisions, outcome, stillOpen, type Decided } from '@/lib/decisions';
import { StateIcon } from './brand';

type AlertRow = { id: string; what_happened: string; amount: number; rule_triggered: string; created_at: string };

// The demo is seen through one fictional analyst's eyes.
const ANALYST = 'Jordan';
const BRIEFED_KEY = 'tidey-briefed';

// The order Tidey suggests working through the queue.
const ORDER: Action[] = ['escalate', 'analyst', 'close'];
const TASK: Record<Action, { name: string; short: string; unit: string; head: string; voice: string; start: string }> = {
  escalate: {
    name: 'Fraud to Approve',
    short: 'Fraud',
    unit: 'left',
    head: 'Fraud, Waiting for Your Approval',
    voice: 'I’ve recommended a block or hold on each. Nothing happens to a card or account until you approve it.',
    start: 'Review Next Alert',
  },
  analyst: {
    name: 'Judgment Calls',
    short: 'Judgment',
    unit: 'left',
    head: 'Needs Your Call',
    voice: 'Mixed signals on these. For each one I’ve written what doesn’t add up and what I’d check next.',
    start: 'Review Next Alert',
  },
  close: {
    name: 'Closed by Tidey',
    short: 'Closed',
    unit: 'to spot-check',
    head: 'Closed by Tidey',
    voice: 'False alarms I closed on my own. Each one keeps its evidence, so you can check my work.',
    start: 'Spot-Check Next Alert',
  },
};
const DEFAULT_VIEW: Action = 'escalate';
// The three groups are Tidey's sort; Handled is the analyst's own record, kept apart from them.
type View = Action | 'handled';
const isView = (v: string | null): v is View => isAction(v) || v === 'handled';
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const alertTime = (r: RunResult, a: AlertRow) => ((r.trace.steps[0]?.data as { alert_time?: string } | undefined)?.alert_time ?? a.created_at).slice(11, 16);

export function QueueClient({ alerts, mock, featured, settings }: { alerts: AlertRow[]; mock: boolean; featured: string[]; settings: Settings }) {
  const [official, setOfficial] = useState<RunFile | null>(null);
  const [live, setLive] = useState<RunFile | null>(null);
  // Your own live run wins when there is one; the official run is what every visitor sees otherwise.
  const [source, setSource] = useState<'official' | 'live'>('official');
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<View>(DEFAULT_VIEW);
  const [greeting, setGreeting] = useState('Hello');
  // The sort replays once per visit; coming back from a case shows it settled.
  const [intro, setIntro] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decided>>({});

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (isView(v)) setTab(v);
    setDecisions(loadDecisions());
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    const l = loadLive();
    loadOfficial().then((o) => {
      const r = l ?? o;
      if (r?.results.length) {
        let seen = false;
        try {
          seen = sessionStorage.getItem(BRIEFED_KEY) === '1';
          sessionStorage.setItem(BRIEFED_KEY, '1');
        } catch { /* storage blocked: just play it */ }
        if (!seen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setIntro(true);
      }
      setOfficial(o);
      setLive(l);
      setSource(l ? 'live' : 'official');
      setLoaded(true);
    });
  }, []);

  const run = source === 'live' ? live ?? official : official ?? live;
  const runQ = `&run=${run?.kind ?? 'official'}`;
  const onRunUpdate = (f: RunFile) => { setLive(f); setSource('live'); };

  const handled = useMemo(() => {
    const m = new Map<string, RunResult>();
    for (const p of run?.results ?? []) if (isOk(p.jev)) m.set(p.alertId, p.jev);
    return m;
  }, [run]);
  const rows = useMemo(() => alerts.filter((a) => handled.has(a.id)), [alerts, handled]);
  const of = (k: Action) => rows.filter((a) => handled.get(a.id)!.trace.decision.action === k);

  const pick = (k: View) => {
    setTab(k);
    window.history.replaceState(null, '', k === DEFAULT_VIEW ? '/' : `/?view=${k}`);
  };

  const take = (r: RunResult) => {
    const d = r.trace.decision;
    if (d.action === 'close') return `${closedReason(r)}.`;
    if (d.action === 'escalate') return `${VERDICT_LABEL[d.verdict]}. ${d.verdict === 'account_takeover' ? 'Recommends freezing online banking and holding the transfer.' : 'Recommends blocking the card.'}`;
    return firstSentence(r.trace.summary?.recommendation) || (d.verdict === 'legitimate' ? 'Probably fine, but something doesn’t add up.' : `Possible ${VERDICT_LABEL[d.verdict].toLowerCase()}.`);
  };

  if (!loaded) return <div className="hero-skeleton" aria-busy="true" />;

  const runBox = (
    <RunBox
      key="runbox"
      alerts={alerts}
      featured={featured}
      settings={settings}
      mock={mock}
      live={live}
      onUpdate={onRunUpdate}
      lead={`Tidey and the one-model version (OpenAI ${modelName(settings.openaiModel)}) investigate the alerts live, and this queue fills in as each one finishes. A live run is kept in this browser only.`}
    />
  );

  if (rows.length === 0) {
    return (
      <div>
        <section className="hero empty">
          <p className="kicker">Tuesday, October 13</p>
          <h1>{greeting}, {ANALYST}.</h1>
          <p className="hero-sub">I haven’t investigated any alerts yet. Run them below and I’ll sort them here for you as each one finishes.</p>
        </section>
        {runBox}
      </div>
    );
  }

  const n = rows.length;
  const closed = of('close').length;
  const sub = closed
    ? `I investigated yesterday’s **${n} alerts** and closed the **${plural(closed, 'clear false alarm', 'clear false alarms')}** myself. The other **${n - closed}** need you, and I’d start with the fraud approvals.`
    : `I investigated yesterday’s **${n} alerts**. All of them need you, and I’d start with the fraud approvals.`;
  // A group lists only what still needs the analyst; anything they've decided moves to Handled.
  const list = tab === 'handled' ? [] : of(tab).filter((a) => !decisions[a.id]);
  const firstOpen = list[0];
  const decided = rows.filter((a) => decisions[a.id]).sort((x, y) => decisions[y.id].at.localeCompare(decisions[x.id].at));
  const pending = decided.filter((a) => stillOpen(decisions[a.id]));
  const finished = decided.filter((a) => !stillOpen(decisions[a.id]));
  const totalMs = rows.reduce((s, x) => s + handled.get(x.id)!.trace.decisionMs, 0);

  return (
    <div className={intro ? 'intro' : ''}>
      <section className="hero">
        <Tide />
        <p className="kicker">Tuesday, October 13</p>
        <h1><Reveal text={`${greeting}, ${ANALYST}.`} from={0} /></h1>
        <p className="hero-sub"><Reveal text={sub} from={180} /></p>
      </section>

      <Sorter rows={rows} handled={handled} tab={tab} onPick={pick} intro={intro} totalMs={totalMs} decisions={decisions} reviewed={decided.length} pending={pending.length}>
        {tab === 'handled' ? (
          <section className="inbox" id="inbox" role="tabpanel" aria-labelledby="task-handled">
            <div className="inbox-head">
              <div>
                <h2>Handled by You</h2>
                <p>{decided.length ? 'Everything you’ve decided today. Open any alert to see it again or undo your call.' : 'Nothing yet. Alerts you decide move here from the groups above.'}</p>
              </div>
            </div>
            {[
              { key: 'open', title: 'Still Open', note: 'Waiting on the customer’s reply or the fraud team’s second look.', items: pending },
              { key: 'done', title: 'Done', note: 'Nothing more to do.', items: finished },
            ].filter((g) => g.items.length).map((g) => (
              <div key={g.key} className="handled-group">
                <div className="handled-head"><h3>{g.title} <span>{g.items.length}</span></h3><p>{g.note}</p></div>
                {g.items.map((al, i) => {
                  const r = handled.get(al.id)!;
                  const dc = decisions[al.id];
                  const o = outcome(dc.choice, r.trace.decision.verdict);
                  return (
                    <a key={`h-${al.id}`} className="item" href={`/cases/${al.id}?view=handled${runQ}`} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
                      <span>
                        <div className="what">{al.what_happened}</div>
                        <div className={`outcome-chip ${o.state}`}><StateIcon state={o.state} />{o.short}</div>
                      </span>
                      <span className="meta">
                        <div className="amt">{money(al.amount)}</div>
                        <div className="when">{al.id}, decided {clockTime(dc.at)}</div>
                      </span>
                    </a>
                  );
                })}
              </div>
            ))}
          </section>
        ) : (
          <section className="inbox" id="inbox" role="tabpanel" aria-labelledby={`task-${tab}`}>
            <div className="inbox-head">
              <div>
                <h2>{TASK[tab].head}</h2>
                <p>{TASK[tab].voice}</p>
                <p className="breakdown">{breakdown(tab, of(tab).map((a) => handled.get(a.id)!))}</p>
              </div>
              {firstOpen
                ? <a className="btn primary" href={`/cases/${firstOpen.id}?view=${tab}${runQ}`}>{TASK[tab].start}</a>
                : of(tab).length > 0 && <span className="all-done"><Check />All Done</span>}
            </div>
            {list.map((al, i) => {
              const r = handled.get(al.id)!;
              return (
                <a key={`${tab}-${al.id}`} className="item" href={`/cases/${al.id}?view=${tab}${runQ}`} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
                  <span>
                    <div className="what">{al.what_happened}</div>
                    <div className="take">{take(r)}</div>
                  </span>
                  <span className="meta">
                    <div className="amt">{money(al.amount)}</div>
                    <div className="when">{al.id}, {alertTime(r, al)}</div>
                  </span>
                </a>
              );
            })}
            {list.length === 0 && (
              <div className="empty-group">
                {of(tab).length ? <>You’ve handled every alert in this group. They’re in <button className="linkish" onClick={() => pick('handled')}>Handled</button>.</> : 'Nothing in this group.'}
              </div>
            )}
          </section>
        )}
      </Sorter>

      <p className="foot-note">
        {run?.kind === 'official' ? 'Showing the official test run.' : `Showing your live run from ${new Date(run!.run_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`}
        {official && live && (
          <> <button className="linkish" onClick={() => setSource(source === 'live' ? 'official' : 'live')}>{source === 'live' ? 'Show the official run' : 'Show your live run'}</button></>
        )}
        {mock || run?.mock ? ' Mock mode: decisions come from stand-in rules, not Jev.' : ''}
      </p>
      {runBox}
    </div>
  );
}

// Words fade in one after another, the first time only. Text between ** markers is set in bold.
function Reveal({ text, from }: { text: string; from: number }) {
  const plain = text.replace(/\*\*/g, '');
  let i = 0;
  return (
    <span aria-label={plain}>
      {text.split('**').map((part, k) =>
        part.split(' ').filter(Boolean).map((w) => {
          const d = { '--d': `${from + i++ * 16}ms` } as CSSProperties;
          return k % 2 ? <b key={i} aria-hidden="true" className="w" style={d}>{w} </b> : <span key={i} aria-hidden="true" className="w" style={d}>{w} </span>;
        }),
      )}
    </span>
  );
}

// What Tidey says about each group, from the decisions themselves.
function breakdown(k: Action, rs: RunResult[]): string {
  if (!rs.length) return k === 'close' ? 'Nothing closed on its own.' : 'Nothing waiting.';
  if (k === 'escalate') {
    const by = new Map<Verdict, number>();
    for (const r of rs) by.set(r.trace.decision.verdict, (by.get(r.trace.decision.verdict) ?? 0) + 1);
    const KIND: Partial<Record<Verdict, [string, string]>> = {
      card_not_present_fraud: ['stolen card used online', 'stolen cards used online'],
      account_takeover: ['account takeover', 'account takeovers'],
      card_testing: ['card-testing burst', 'card-testing bursts'],
    };
    return `${[...by.entries()].sort((a, b) => b[1] - a[1]).map(([v, c]) => plural(c, ...(KIND[v] ?? [VERDICT_LABEL[v].toLowerCase(), VERDICT_LABEL[v].toLowerCase()]))).join(', ')}.`;
  }
  if (k === 'analyst') {
    const fine = rs.filter((r) => r.trace.decision.verdict === 'legitimate').length;
    const parts = [fine ? `${fine} probably fine` : '', rs.length - fine ? `${rs.length - fine} possible fraud` : ''].filter(Boolean);
    return `${parts.join(', ')}. Each has a note on what doesn’t add up.`;
  }
  const kinds = new Map<string, number>();
  for (const r of rs) {
    const why = closedReason(r);
    const kind = /trip/.test(why) ? 'booked trips' : /phone/.test(why) ? 'verified new phones' : /authorized/.test(why) ? 'authorized users' : /verified/.test(why) ? 'verified changes' : /last year/.test(why) ? 'known yearly charges' : 'normal spending';
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  return `Explained by ${[...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([w, c]) => `${w} (${c})`).join(', ')}.`;
}

// The three groups, in the order Tidey suggests. On a first visit, yesterday's alerts drop into them in time order.
function Sorter({ rows, handled, tab, onPick, intro, totalMs, decisions, reviewed, pending, children }: { rows: AlertRow[]; handled: Map<string, RunResult>; tab: View; onPick: (k: View) => void; intro: boolean; totalMs: number; decisions: Record<string, Decided>; reviewed: number; pending: number; children: React.ReactNode }) {
  const events = useMemo(
    () => rows.map((a) => ({ id: a.id, time: alertTime(handled.get(a.id)!, a), action: handled.get(a.id)!.trace.decision.action })).sort((x, y) => x.time.localeCompare(y.time)),
    [rows, handled],
  );
  const START = 500, SPAN = 2600;
  const at = (i: number) => START + (i * SPAN) / Math.max(1, events.length - 1);
  const [t, setT] = useState(intro ? 0 : Infinity);

  useEffect(() => {
    if (!intro) { setT(Infinity); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const e = now - t0;
      setT(e);
      if (e < START + SPAN + 200) raf = requestAnimationFrame(tick);
      else setT(Infinity);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [intro]);

  const landed = events.filter((_, i) => at(i) <= t);
  const sorting = landed.length < events.length;
  const clock = landed.length ? landed[landed.length - 1].time : '00:00';

  return (
    <>
      <div className="queue-bar">
        <p className={`sort-status${sorting ? ' sorting' : ''}`} aria-live="polite">
          <i />
          {sorting
            ? <>Sorting yesterday’s alerts <span className="clock">{clock}</span></>
            : <>All {events.length} sorted, in {secs(totalMs)} of work{reviewed ? <>. You’ve handled {reviewed}{pending ? <>, and {pending} {pending === 1 ? 'is' : 'are'} still open</> : null}.</> : null}</>}
        </p>
        <button id="task-handled" aria-pressed={tab === 'handled'} aria-controls="inbox" className="handled-btn" onClick={() => onPick('handled')}>
          <Check />Handled<span className="count">{reviewed}</span>
        </button>
      </div>
      <div className={`qtrack${tab === 'handled' ? ' off' : ''}`} role="tablist" aria-label="Alert groups" style={{ '--idx': Math.max(0, ORDER.indexOf(tab as Action)) } as CSSProperties}>
          <span className="qthumb" aria-hidden="true" />
          {ORDER.map((k) => {
            const mine = events.filter((e) => e.action === k);
            const done = mine.filter((e) => decisions[e.id]).length;
            const open = mine.length - done;
            // Counts climb as alerts land during the replay, then show what is left to do.
            const shown = sorting ? landed.filter((e) => e.action === k && !decisions[e.id]).length : open;
            const waiting = k !== 'close' && open > 0;
            const finished = mine.length > 0 && open === 0;
            return (
              <button key={k} id={`task-${k}`} role="tab" aria-selected={tab === k} aria-controls="inbox" className={`qtab ${k}${finished ? ' finished' : ''}`} onClick={() => onPick(k)}>
                <span className="qtab-name"><i className={waiting ? 'pulsing' : ''} /><span className="long">{TASK[k].name}</span><span className="short" aria-hidden="true">{TASK[k].short}</span></span>
                <span className="qtab-count">
                  {finished
                    ? <span className="qtab-done"><Check />All Done</span>
                    : <><b>{shown}</b><span>of {mine.length} {TASK[k].unit}</span></>}
                </span>
                <span className="qtab-bar" aria-hidden="true"><b style={{ width: `${mine.length ? (100 * done) / mine.length : 0}%` }} /></span>
              </button>
            );
          })}
      </div>
      <div className="queue-panel">{children}</div>
    </>
  );
}

// A quiet tide behind the greeting: the Tidewell wave, drifting.
function Tide() {
  // A smooth sine: one quadratic hump, then each T mirrors the last one.
  const wave = (y: number, a: number) => {
    let d = `M-240 ${y} Q-210 ${y - a} -180 ${y}`;
    for (let x = -120; x <= 960; x += 60) d += ` T${x} ${y}`;
    return d;
  };
  return (
    <svg className="tide-art" viewBox="0 0 720 240" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
      <g className="tide-a"><path d={wave(80, 16)} /></g>
      <g className="tide-b"><path d={wave(125, 22)} /></g>
      <g className="tide-c"><path d={wave(170, 14)} /></g>
    </svg>
  );
}

function Check() {
  return (
    <svg className="check" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
