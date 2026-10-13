// Browser-side storage for runs. Official results are a static file; a live run lives in this browser tab only.
import type { RunResult } from './types';

export type Settings = {
  closeAt: number; unexplainedMax: number; escalateAt: number; scamRiskAt: number; maxAutoCloseAmount: number; checkAt: number;
  jevModel: string; openaiModel: string;
};
export type Failed = { error: string };
export type Pair = { alertId: string; jev?: RunResult | Failed; llm?: RunResult | Failed };
export type RunFile = { kind: 'official' | 'live'; run_at: string; mock: boolean; settings: Settings; results: Pair[] };

const KEY = 'fraud-agent-live-run';
export const isOk = (r: RunResult | Failed | undefined): r is RunResult => !!r && 'trace' in r;

export function loadLive(): RunFile | null {
  try {
    const s = sessionStorage.getItem(KEY);
    return s ? (JSON.parse(s) as RunFile) : null;
  } catch {
    return null;
  }
}

export function saveLive(r: RunFile) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage full or blocked: the run still shows on this page */
  }
}

export async function loadOfficial(): Promise<RunFile | null> {
  try {
    const res = await fetch('/results/official.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const j = (await res.json()) as RunFile;
    return { ...j, kind: 'official' };
  } catch {
    return null;
  }
}

export async function runOne(alertId: string, mode: 'jev' | 'llm', passcode: string): Promise<RunResult | Failed> {
  try {
    const res = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertId, mode, passcode }) });
    const j = await res.json();
    if (!res.ok) return { error: j.error ?? `Error ${res.status}` };
    return j as RunResult;
  } catch (e) {
    return { error: (e as Error).message };
  }
}
