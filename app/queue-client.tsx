'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { TideyBadge } from './brand';
import { closedReason, firstSentence } from '@/lib/headlines';
import { GROUPS, VERDICT_LABEL, isAction, money, secs } from '@/lib/labels';
import { isOk, loadLive, loadOfficial, type RunFile } from '@/lib/store';
import type { Action, RunResult } from '@/lib/types';

type AlertRow = { id: string; what_happened: string; amount: number; rule_triggered: string; created_at: string };

// The demo is seen through one fictional analyst's eyes.
const ANALYST = 'Jordan';
const BRIEFED_KEY = 'tidey-briefed';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function QueueClient({ alerts, mock }: { alerts: AlertRow[]; mock: boolean }) {
  const [run, setRun] = useState<RunFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Action>('analyst');
  const [greeting, setGreeting] = useState('Hello');
  // The briefing plays once per visit; coming back from a case shows it settled.
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (isAction(v)) setTab(v);
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    const live = loadLive();
    loadOfficial().then((o) => {
      const r = o ?? live;
      let seen = false;
      if (r?.results.length) {
        try {
          seen = sessionStorage.getItem(BRIEFED_KEY) === '1';
          sessionStorage.setItem(BRIEFED_KEY, '1');
        } catch { /* storage blocked: just play it */ }
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!seen && !still) {
          setIntro(true);
          window.setTimeout(() => setIntro(false), 5200);
        }
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
  const count = (k: Action) => of(k).length;
  const group = GROUPS.find((g) => g.key === tab)!;
  const pick = (k: Action, scroll = false) => {
    setTab(k);
    window.history.replaceState(null, '', k === 'analyst' ? '/' : `/?view=${k}`);
    if (scroll) document.getElementById('groups')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const take = (r: RunResult) => {
    const d = r.trace.decision;
    if (d.action === 'close') return `${closedReason(r)}.`;
    if (d.action === 'escalate') return `${VERDICT_LABEL[d.verdict]}. ${firstSentence(r.trace.summary?.recommendation) || 'Recommends a block.'}`;
    return firstSentence(r.trace.summary?.recommendation) || (d.verdict === 'legitimate' ? 'Probably fine, but something doesn’t add up.' : `Possible ${VERDICT_LABEL[d.verdict].toLowerCase()}.`);
  };

  if (!loaded) return <div className="brief-skeleton" aria-busy="true" />;

  if (rows.length === 0) {
    return (
      <section className="brief solo">
        <div className="brief-msg">
          <TideyBadge size={44} live />
          <div>
            <p className="brief-meta"><b>Tidey</b></p>
            <h1>{greeting}, {ANALYST}.</h1>
            <p className="say">I haven’t investigated any alerts yet. Run them from the <a href="/proof#run">Test results</a> page and they’ll show up here, sorted.</p>
          </div>
        </div>
      </section>
    );
  }

  const n = rows.length, c = count('close'), e = count('escalate'), a = count('analyst');
  const message = [
    `I investigated all ${n} alerts the fraud rules raised yesterday.`,
    c ? `I closed ${c} clear false ${plural(c, 'alarm', 'alarms')} myself.` : 'None of them were clear false alarms.',
    e ? `${e} ${plural(e, 'looks', 'look')} like fraud. Nothing gets blocked until you approve, so I’d start there.` : '',
    a ? `${e ? 'The other ' : ''}${a} ${plural(a, 'has', 'have')} mixed signals and ${plural(a, 'needs', 'need')} your judgment. I’ve noted what doesn’t add up on each.` : '',
    !e && !a ? 'Nothing is waiting for you.' : '',
  ].filter(Boolean).join(' ');
  const firstFraud = of('escalate')[0];
  const greetWords = `${greeting}, ${ANALYST}.`.split(' ');
  const words = message.split(' ');
  const tSay = 600, step = 17;
  const tDone = tSay + (greetWords.length + words.length) * step + 150;
  const totalMs = rows.reduce((s, x) => s + handled.get(x.id)!.trace.decisionMs, 0);

  return (
    <div className={intro ? 'intro' : ''} style={{ '--done': `${tDone}ms` } as CSSProperties}>
      <section className="brief">
        <div className="brief-msg">
          <TideyBadge size={44} live />
          <div>
            <p className="brief-meta">
              <b>Tidey</b>
              <span className="typing" aria-hidden="true"><i /><i /><i /></span>
              <span className="when">Tuesday, October 13</span>
            </p>
            <h1 aria-label={`${greeting}, ${ANALYST}.`}>
              {greetWords.map((w, i) => <span key={i} aria-hidden="true" className="w" style={{ '--d': `${tSay + i * step}ms` } as CSSProperties}>{w} </span>)}
            </h1>
            <p className="say" aria-label={message}>
              {words.map((w, i) => <span key={i} aria-hidden="true" className="w" style={{ '--d': `${tSay + (greetWords.length + i) * step}ms` } as CSSProperties}>{w} </span>)}
            </p>
            <div className="brief-acts">
              {firstFraud && <a className="btn primary" href={`/cases/${firstFraud.id}?view=escalate`}>Start with the {e} fraud {plural(e, 'approval', 'approvals')}</a>}
              {a > 0 && <button className="btn" onClick={() => pick('analyst', true)}>See the {a} judgment {plural(a, 'call', 'calls')}</button>}
            </div>
          </div>
        </div>
        <NightLog rows={rows} handled={handled} intro={intro} totalMs={totalMs} />
      </section>

      <div className="tideline" aria-hidden="true" id="groups">
        <div className="bar">
          {GROUPS.map((g) => <i key={g.key} className={g.key} style={{ width: `${(100 * count(g.key)) / n}%` }} />)}
        </div>
      </div>

      <div className="qtabs" role="tablist" aria-label="Alert groups">
        {GROUPS.map((g) => (
          <button key={g.key} role="tab" id={`tab-${g.key}`} aria-selected={tab === g.key} aria-controls="inbox" className={`qtab ${g.key}`} onClick={() => pick(g.key)}>
            <span className="qtab-label">
              <i className={`dot-${g.key}${g.key !== 'close' && count(g.key) > 0 ? ' pulsing' : ''}`} />
              {g.label}
            </span>
            <b><CountUp to={count(g.key)} play={intro} /></b>
          </button>
        ))}
      </div>

      <section className="inbox" id="inbox" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <div className="inbox-head">
          <TideyBadge size={30} />
          <div>
            <h2>{group.title}</h2>
            <p>{VOICE[tab]}</p>
          </div>
        </div>
        {of(tab).map((al, i) => {
          const r = handled.get(al.id)!;
          const ctx = r.trace.steps[0]?.data as { alert_time?: string } | undefined;
          return (
            <a key={`${tab}-${al.id}`} className="item" href={`/cases/${al.id}?view=${tab}`} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
              <span className={`edge ${tab}`} />
              <span>
                <div className="what">{al.what_happened}</div>
                <div className="take">{take(r)}</div>
              </span>
              <span className="meta">
                <div className="amt">{money(al.amount)}</div>
                <div className="when">{al.id}, {(ctx?.alert_time ?? al.created_at).slice(11, 16)}</div>
              </span>
            </a>
          );
        })}
        {count(tab) === 0 && <div className="inbox-head"><p>Nothing here.</p></div>}
      </section>

      <p className="foot-note">
        {run?.kind === 'official' ? 'This queue shows the official test run.' : 'This queue shows your latest live run.'} Tidewell is fictional and every alert is synthetic.
        {mock || run?.mock ? ' Mock mode: decisions come from stand-in rules, not Jev.' : ''} Tidey averaged {secs(totalMs / n)} per decision. How well it sorts alerts is measured on the <a href="/proof">Test results</a> page.
      </p>
    </div>
  );
}

// What Tidey says at the top of each group, in its own voice.
const VOICE: Record<Action, string> = {
  analyst: 'Mixed signals on these. For each one I’ve written what doesn’t add up and what I’d check next.',
  escalate: 'These look like fraud. I’ve recommended a block or hold on each, and nothing happens until you approve it.',
  close: 'False alarms I closed on my own. Each one keeps its evidence if you want to spot-check me.',
};

// Tidey's work log from yesterday, newest first. On a first visit it replays quickly, one line per alert.
function NightLog({ rows, handled, intro, totalMs }: { rows: AlertRow[]; handled: Map<string, RunResult>; intro: boolean; totalMs: number }) {
  const events = useMemo(
    () =>
      rows
        .map((a) => {
          const r = handled.get(a.id)!;
          const d = r.trace.decision;
          const ctx = r.trace.steps[0]?.data as { alert_time?: string } | undefined;
          const time = (ctx?.alert_time ?? a.created_at).slice(11, 16);
          const reason = closedReason(r);
          const text =
            d.action === 'close' ? `Closed: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`
            : d.action === 'escalate' ? `${VERDICT_LABEL[d.verdict]}, waiting for approval`
            : 'Mixed signals, sent to you';
          return { id: a.id, time, action: d.action, text };
        })
        .sort((x, y) => x.time.localeCompare(y.time)),
    [rows, handled],
  );
  const [shown, setShown] = useState(intro ? 0 : events.length);

  useEffect(() => {
    if (!intro) { setShown(events.length); return; }
    setShown(0);
    let i = 0;
    let timer = 0;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= events.length) window.clearInterval(timer);
      }, Math.max(28, 2400 / events.length));
    }, 900);
    return () => { window.clearTimeout(start); window.clearInterval(timer); };
  }, [intro, events.length]);

  const list = events.slice(0, shown).reverse();
  const working = shown < events.length;
  return (
    <aside className="nightlog" aria-label="What Tidey did yesterday">
      <div className="nightlog-head">
        <b>What I did yesterday</b>
        <span className={working ? 'working' : ''}>{working ? <>Investigating {shown} of {events.length}</> : <>{events.length} alerts in {secs(totalMs)}</>}</span>
      </div>
      <ol>
        {list.map((ev) => (
          <li key={ev.id}>
            <a href={`/cases/${ev.id}?view=${ev.action}`} title={`${ev.id}: ${ev.text}`}>
              <span className="t">{ev.time}</span>
              <i className={`dot-${ev.action}`} />
              <span className="x"><b>{ev.id}</b> {ev.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function CountUp({ to, play }: { to: number; play: boolean }) {
  const [v, setV] = useState(play ? 0 : to);
  useEffect(() => {
    if (!play) { setV(to); return; }
    let raf = 0;
    const t0 = performance.now() + 1900;
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 900));
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, play]);
  return <>{v}</>;
}
