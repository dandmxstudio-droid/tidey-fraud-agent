'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type Lane = 'code' | 'jev' | 'ai' | 'person';
export type Example =
  | { kind: 'facts'; rows: [string, string][] }
  | { kind: 'bars'; question: string; threshold?: number; rows: { label: string; value: number; tag?: string }[]; foot?: string }
  | { kind: 'lines'; rows: { label: string; text: string }[] }
  | { kind: 'outcome'; pill: string; text: string }
  | { kind: 'quote'; text: string; rec: string }
  | { kind: 'approve'; title: string; body: string };
export type PipeStep = { lane: Lane; title: string; body: string; example: Example };

const LANES: { key: Lane; name: string; job: string }[] = [
  { key: 'code', name: 'Code', job: 'Exact work: facts, records, rules' },
  { key: 'jev', name: 'Jev', job: 'Judgment calls, with probabilities' },
  { key: 'ai', name: 'AI Model', job: 'Writes for people' },
  { key: 'person', name: 'Person', job: 'Has the final say' },
];
const laneIdx = (l: Lane) => LANES.findIndex((x) => x.key === l);
const STEP_MS = 3600;

// One alert travels through Tidey. Each step sits in the lane of whoever does it.
export function Pipeline({ steps, alertLabel }: { steps: PipeStep[]; alertLabel: string }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 700, h: 400 });

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Start playing the first time the diagram scrolls into view, unless motion is reduced.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !seen) {
        setSeen(true);
        if (!still) setPlaying(true);
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % steps.length), active === steps.length - 1 ? STEP_MS + 1800 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, active, steps.length]);

  const go = (i: number) => { setPlaying(false); setActive((i + steps.length) % steps.length); };
  // Node centers as fractions of the track: columns across, a little above the middle of each lane (titles sit below).
  const frac = steps.map((st, i) => ({ fx: (i + 0.5) / steps.length, fy: (laneIdx(st.lane) + 0.34) / LANES.length }));
  const pos = frac.map((f) => ({ x: f.fx * box.w, y: f.fy * box.h }));
  const s = steps[active];

  return (
    <div className="pipe" ref={ref}>
      <div className="stage" style={{ '--cols': steps.length } as CSSProperties}>
        <div className="lane-names">
          {LANES.map((l) => (
            <div key={l.key} className={`lane-name ${l.key}${s.lane === l.key ? ' on' : ''}`}>
              <b><i />{l.name}</b>
              <span>{l.job}</span>
            </div>
          ))}
        </div>
        <div className="lanes-track" ref={trackRef}>
          {LANES.map((l) => <div key={l.key} className={`band${s.lane === l.key ? ' on' : ''}`} />)}
          <svg className="wires" viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
            {pos.slice(1).map((p, i) => {
              const a = pos[i];
              const mx = (a.x + p.x) / 2;
              const d = `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${p.y} ${p.x} ${p.y}`;
              return (
                <g key={i}>
                  <path d={d} className="wire" />
                  <path d={d} className="wire-lit" pathLength={1} style={{ strokeDashoffset: i < active ? 0 : 1 }} />
                </g>
              );
            })}
          </svg>
          {steps.map((st, i) => (
            <button
              key={st.title}
              className={`node ${st.lane}${i < active ? ' done' : ''}${i === active ? ' on' : ''}`}
              style={{ left: `${frac[i].fx * 100}%`, top: `${frac[i].fy * 100}%` }}
              onClick={() => go(i)}
              aria-label={`Step ${i + 1}: ${st.title}`}
              aria-current={i === active ? 'step' : undefined}
            >
              <span className="dot">{i + 1}</span>
              <span className="node-title">{st.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pipe-detail">
        <div className="pd-text" key={`t-${active}`}>
          <p className="pd-step">Step {active + 1} of {steps.length}<span className={`who-chip ${s.lane}`}>{LANES[laneIdx(s.lane)].name}</span></p>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
          <div className="pd-controls">
            <button className="btn pager-btn" onClick={() => go(active - 1)} aria-label="Previous step">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button className="btn pager-btn play" onClick={() => setPlaying((p) => !p)}>
              {playing ? (
                <><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor" /><rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor" /></svg>Pause</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 2.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L4.4 1.7a.6.6 0 0 0-.9.5Z" fill="currentColor" /></svg>Play</>
              )}
            </button>
            <button className="btn pager-btn" onClick={() => go(active + 1)} aria-label="Next step">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {playing && <span className="pd-timer" key={`k-${active}`} style={{ animationDuration: `${active === steps.length - 1 ? STEP_MS + 1800 : STEP_MS}ms` }} />}
          </div>
        </div>
        <div className="pd-example" key={`e-${active}`}>
          <p className="pd-ex-head">In {alertLabel}</p>
          <ExampleView ex={s.example} lane={s.lane} />
        </div>
      </div>
    </div>
  );
}

function ExampleView({ ex, lane }: { ex: Example; lane: Lane }) {
  switch (ex.kind) {
    case 'facts':
      return <dl className="ex-facts">{ex.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
    case 'bars':
      return (
        <div className={`ex-bars ${lane}`}>
          <p className="ex-q">{ex.question}</p>
          {ex.rows.map((r, i) => (
            <div key={r.label} className={`ex-bar${ex.threshold !== undefined && r.value < ex.threshold ? ' below' : ''}`}>
              <span className="l">{r.label}</span>
              <span className="track">
                <b style={{ width: `${r.value * 100}%`, animationDelay: `${i * 90}ms` }} />
                {ex.threshold !== undefined && <em style={{ left: `${ex.threshold * 100}%` }} />}
              </span>
              <span className="v">{r.value.toFixed(2)}</span>
              {r.tag && <span className="tagline">{r.tag}</span>}
            </div>
          ))}
          {ex.foot && <p className="ex-foot">{ex.foot}</p>}
        </div>
      );
    case 'lines':
      return <ul className="ex-lines">{ex.rows.map((r, i) => <li key={r.label} style={{ animationDelay: `${i * 110}ms` }}><b>{r.label}</b><span>{r.text}</span></li>)}</ul>;
    case 'outcome':
      return <div className="ex-outcome"><span className="pill escalate">{ex.pill}</span><p>{ex.text}</p></div>;
    case 'quote':
      return <div className="ex-quote"><p>{ex.text}</p><p className="rec"><b>Recommendation:</b> {ex.rec}</p></div>;
    case 'approve':
      return (
        <div className="ex-approve">
          <div><b>{ex.title}</b><p>{ex.body}</p></div>
          <div className="acts" aria-hidden="true"><span className="btn">Not Fraud</span><span className="btn danger">Approve Block</span></div>
        </div>
      );
  }
}
