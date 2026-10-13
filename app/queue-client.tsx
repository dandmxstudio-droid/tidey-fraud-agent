'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { closedReason, firstSentence } from '@/lib/headlines';
import { VERDICT_LABEL, isAction, money, secs } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, type RunFile } from '@/lib/store';
import type { Action, RunResult, Verdict } from '@/lib/types';
import { loadDecisions, outcome, type Decided } from '@/lib/decisions';

type AlertRow = { id: string; what_happened: string; amount: number; rule_triggered: string; created_at: string };

// The demo is seen through one fictional analyst's eyes.
const ANALYST = 'Jordan';
const BRIEFED_KEY = 'tidey-briefed';

// The order Tidey suggests working through the queue.
const ORDER: Action[] = ['escalate', 'analyst', 'close'];
const TASK: Record<Action, { label: (n: number) => string; status: string; head: string; voice: string; start: string }> = {
  escalate: {
    label: (n) => `fraud ${n === 1 ? 'block' : 'blocks'} to approve`,
    status: 'Waiting on you',
    head: 'Fraud, waiting for your approval',
    voice: 'I’ve recommended a block or hold on each. Nothing happens to a card or account until you approve it.',
    start: 'Review in order',
  },
  analyst: {
    label: (n) => `judgment ${n === 1 ? 'call' : 'calls'}`,
    status: 'Waiting on you',
    head: 'Needs your call',
    voice: 'Mixed signals on these. For each one I’ve written what doesn’t add up and what I’d check next.',
    start: 'Review in order',
  },
  close: {
    label: () => 'closed by me',
    status: 'Spot-check if you like',
    head: 'Closed by Tidey',
    voice: 'False alarms I closed on my own. Each one keeps its evidence, so you can check my work.',
    start: 'Spot-check in order',
  },
};
const DEFAULT_VIEW: Action = 'escalate';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const alertTime = (r: RunResult, a: AlertRow) => ((r.trace.steps[0]?.data as { alert_time?: string } | undefined)?.alert_time ?? a.created_at).slice(11, 16);

export function QueueClient({ alerts, mock }: { alerts: AlertRow[]; mock: boolean }) {
  const [run, setRun] = useState<RunFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Action>(DEFAULT_VIEW);
  const [greeting, setGreeting] = useState('Hello');
  // The sort replays once per visit; coming back from a case shows it settled.
  const [intro, setIntro] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decided>>({});

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (isAction(v)) setTab(v);
    setDecisions(loadDecisions());
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    const live = loadLive();
    loadOfficial().then((o) => {
      const r = o ?? live;
      if (r?.results.length) {
        let seen = false;
        try {
          seen = sessionStorage.getItem(BRIEFED_KEY) === '1';
          sessionStorage.setItem(BRIEFED_KEY, '1');
        } catch { /* storage blocked: just play it */ }
        if (!seen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setIntro(true);
      }
      setRun(r);
      setLoaded(true);
    });
  }, []);

  const handled = useMemo(() => {
    const m = new Map<string, RunResult>();
    for (const p of run?.results ?? []) if (isOk(p.jev)) m.set(p.alertId, p.jev);
    return m;
  }, [run]);
  const rows = useMemo(() => alerts.filter((a) => handled.has(a.id)), [alerts, handled]);
  const of = (k: Action) => rows.filter((a) => handled.get(a.id)!.trace.decision.action === k);

  const pick = (k: Action) => {
    setTab(k);
    window.history.replaceState(null, '', k === DEFAULT_VIEW ? '/' : `/?view=${k}`);
  };

  const take = (r: RunResult) => {
    const d = r.trace.decision;
    if (d.action === 'close') return `${closedReason(r)}.`;
    if (d.action === 'escalate') return `${VERDICT_LABEL[d.verdict]}. ${firstSentence(r.trace.summary?.recommendation) || 'Recommends a block.'}`;
    return firstSentence(r.trace.summary?.recommendation) || (d.verdict === 'legitimate' ? 'Probably fine, but something doesn’t add up.' : `Possible ${VERDICT_LABEL[d.verdict].toLowerCase()}.`);
  };

  if (!loaded) return <div className="hero-skeleton" aria-busy="true" />;

  if (rows.length === 0) {
    return (
      <section className="hero">
        <p className="kicker">Tuesday, October 13</p>
        <h1>{greeting}, {ANALYST}.</h1>
        <p className="hero-sub">I haven’t investigated any alerts yet. Run them from the <a href="/proof#run">Test results</a> page and they’ll show up here, sorted.</p>
      </section>
    );
  }

  const n = rows.length;
  const closed = of('close').length;
  const sub = closed
    ? `I investigated yesterday’s ${n} alerts and closed the ${plural(closed, 'clear false alarm', 'clear false alarms')} myself. The other ${n - closed} need you. Here’s the order I’d take them in.`
    : `I investigated yesterday’s ${n} alerts. All of them need you. Here’s the order I’d take them in.`;
  // Alerts still waiting come first; ones the analyst already decided sink to the bottom.
  const list = [...of(tab).filter((a) => !decisions[a.id]), ...of(tab).filter((a) => decisions[a.id])];
  const firstOpen = list.find((a) => !decisions[a.id]);
  const reviewed = rows.filter((a) => decisions[a.id]).length;
  const totalMs = rows.reduce((s, x) => s + handled.get(x.id)!.trace.decisionMs, 0);

  return (
    <div className={intro ? 'intro' : ''}>
      <section className="hero">
        <Tide />
        <p className="kicker">Tuesday, October 13</p>
        <h1><Reveal text={`${greeting}, ${ANALYST}.`} from={0} /></h1>
        <p className="hero-sub"><Reveal text={sub} from={180} /></p>
      </section>

      <Sorter rows={rows} handled={handled} tab={tab} onPick={pick} intro={intro} totalMs={totalMs} decisions={decisions} reviewed={reviewed} />

      <section className="inbox" id="inbox" role="tabpanel" aria-labelledby={`task-${tab}`}>
        <div className="inbox-head">
          <div>
            <h2>{TASK[tab].head}</h2>
            <p>{TASK[tab].voice}</p>
          </div>
          {firstOpen
            ? <a className="btn primary" href={`/cases/${firstOpen.id}?view=${tab}`}>{list.some((a) => decisions[a.id]) ? 'Continue' : TASK[tab].start}</a>
            : list.length > 0 && <span className="all-done"><Check />All done</span>}
        </div>
        {list.map((al, i) => {
          const r = handled.get(al.id)!;
          const dc = decisions[al.id];
          const o = dc ? outcome(dc.choice, r.trace.decision.verdict) : null;
          return (
            <a key={`${tab}-${al.id}`} className={`item${o ? ' done' : ''}`} href={`/cases/${al.id}?view=${tab}`} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
              <span className={`edge ${o ? 'settled' : tab}`} />
              <span>
                <div className="what">{al.what_happened}</div>
                {o ? <div className={`outcome-chip tone-${o.tone}`}><Check />{o.short}</div> : <div className="take">{take(r)}</div>}
              </span>
              <span className="meta">
                <div className="amt">{money(al.amount)}</div>
                <div className="when">{al.id}, {alertTime(r, al)}</div>
              </span>
            </a>
          );
        })}
        {list.length === 0 && <div className="inbox-head"><p>Nothing here.</p></div>}
      </section>

      <p className="foot-note">
        {run?.kind === 'official' ? 'This queue shows the official test run.' : 'This queue shows your latest live run.'} Tidewell is fictional and every alert is synthetic.
        {mock || run?.mock ? ' Mock mode: decisions come from stand-in rules, not Jev.' : ''} How well Tidey sorts alerts is measured on the <a href="/proof">Test results</a> page.
      </p>
    </div>
  );
}

// Words fade in one after another, the first time only.
function Reveal({ text, from }: { text: string; from: number }) {
  return (
    <span aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden="true" className="w" style={{ '--d': `${from + i * 16}ms` } as CSSProperties}>{w} </span>
      ))}
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
function Sorter({ rows, handled, tab, onPick, intro, totalMs, decisions, reviewed }: { rows: AlertRow[]; handled: Map<string, RunResult>; tab: Action; onPick: (k: Action) => void; intro: boolean; totalMs: number; decisions: Record<string, Decided>; reviewed: number }) {
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
    <section className="tasks-wrap" aria-label="Your queue">
      <p className={`sort-status${sorting ? ' sorting' : ''}`} aria-live="polite">
        <i />
        {sorting
          ? <>Sorting yesterday’s alerts <span className="clock">{clock}</span></>
          : <>All {events.length} sorted, in {secs(totalMs)} of work{reviewed ? <>. You’ve handled {reviewed} so far.</> : null}</>}
      </p>
      <div className="tasks" role="tablist" aria-label="Alert groups">
        {ORDER.map((k, idx) => {
          const mine = events.filter((e) => e.action === k);
          const done = mine.filter((e) => decisions[e.id]).length;
          const open = mine.length - done;
          // Counts climb as alerts land during the replay, then show what is left to do.
          const shown = sorting ? landed.filter((e) => e.action === k && !decisions[e.id]).length : open;
          const rs = mine.map((e) => handled.get(e.id)!);
          const waiting = k !== 'close' && open > 0;
          const finished = mine.length > 0 && open === 0;
          return (
            <button key={k} id={`task-${k}`} role="tab" aria-selected={tab === k} aria-controls="inbox" className={`task ${k}${finished ? ' finished' : ''}`} onClick={() => onPick(k)}>
              <span className="task-top">
                <span className="task-n">{finished ? <Check /> : idx + 1}</span>
                <span className="task-status"><i className={waiting ? 'pulsing' : ''} />{finished ? 'All done' : TASK[k].status}</span>
              </span>
              {k === 'close'
                ? <span className="task-count"><b>{sorting ? shown : mine.length}</b>{TASK[k].label(mine.length)}</span>
                : <span className="task-count"><b>{shown}</b>{finished ? 'left' : TASK[k].label(open)}</span>}
              <span className="task-progress">
                <span className="track"><b style={{ width: `${mine.length ? (100 * done) / mine.length : 0}%` }} /></span>
                <span className="task-progress-label">{done} of {mine.length} {k === 'close' ? 'spot-checked' : 'reviewed'}</span>
              </span>
              <span className="task-note">{breakdown(k, rs)}</span>
            </button>
          );
        })}
      </div>
    </section>
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
