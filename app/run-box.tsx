'use client';
import { useState } from 'react';
import { isOk, runOne, saveLive, type Pair, type RunFile, type Settings } from '@/lib/store';
import { DATASET } from '@/lib/dataset';

type AlertRow = { id: string };

// Runs alerts through Tidey and the one-model baseline, live. Results stream back through onUpdate as each alert finishes.
export function RunBox({ alerts, featured, settings, mock, live, onUpdate, lead }: {
  alerts: AlertRow[];
  featured: string[];
  settings: Settings;
  mock: boolean;
  live: RunFile | null;
  onUpdate: (f: RunFile) => void;
  lead: string;
}) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [msg, setMsg] = useState('');

  async function start(ids: string[], passcode: string, base?: RunFile) {
    setBusy(true);
    setMsg('');
    const results = new Map<string, Pair>((base?.results ?? []).map((p) => [p.alertId, p]));
    let done = 0;
    setProgress({ done, total: ids.length });
    const file = (): RunFile => ({ kind: 'live', dataset: DATASET, run_at: new Date().toISOString(), mock, settings, results: alerts.filter((a) => results.has(a.id)).map((a) => results.get(a.id)!) });
    const queue = [...ids];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!;
        const [jev, llm] = await Promise.all([runOne(id, 'jev', passcode), runOne(id, 'llm', passcode)]);
        results.set(id, { alertId: id, jev, llm });
        done++;
        setProgress({ done, total: ids.length });
        const f = file();
        saveLive(f);
        onUpdate(f);
        if ('error' in jev && /passcode|sample/i.test(jev.error)) { queue.length = 0; setMsg(jev.error); }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    const f = file();
    const errs = f.results.flatMap((p) => [p.jev, p.llm]).filter((r) => r && !isOk(r)) as { error: string }[];
    if (errs.length) setMsg(`${errs.length} runs failed. First error: ${errs[0].error.slice(0, 200)}`);
    saveLive(f);
    onUpdate(f);
    setBusy(false);
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

  return (
    <section className="section" id="run">
      <div className="section-head">
        <h2>Run the Test Yourself</h2>
        <p>{lead}</p>
      </div>
      <div className="runbox">
        <div className="run-opt">
          <h3>Five Sample Alerts</h3>
          <p>Open to anyone. A mix of fraud, false alarms and judgment calls. Takes about a minute.</p>
          <button className="btn primary" disabled={busy} onClick={() => start(featured, pass)}>Run the Sample Alerts</button>
        </div>
        <div className="run-opt">
          <h3>All {alerts.length} Alerts</h3>
          <p>For the owner. Needs the passcode, because every run costs API credits.</p>
          <div className="row">
            <input className="pass" type="password" placeholder="Owner passcode" aria-label="Owner passcode" value={pass} onChange={(e) => setPass(e.target.value)} />
            <button className="btn" disabled={busy || !pass} onClick={() => start(alerts.map((a) => a.id), pass)}>Run All {alerts.length}</button>
          </div>
        </div>
        {(busy || msg || (live && !busy)) && (
          <div className="run-status">
            {busy && (
              <>
                <div className="progress"><b style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} /></div>
                <p className="small muted">Tidey is investigating {progress.done} of {progress.total} alerts, alongside the one-model version…</p>
              </>
            )}
            {msg && <p className="small no">{msg}</p>}
            {live && !busy && (
              <div className="row">
                {failed.length > 0 && <button className="btn" onClick={() => start(failed, pass, live)}>Retry {failed.length} Failed</button>}
                <button className="btn" onClick={download}>Download Your Live Run</button>
                <span className="small muted">To publish it as the official run, add the file to <code>public/results/official.json</code> in the repo.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
