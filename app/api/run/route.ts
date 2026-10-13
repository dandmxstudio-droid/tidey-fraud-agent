import { NextResponse } from 'next/server';
import { runJevAgent } from '@/lib/agent-jev';
import { runLlmAgent } from '@/lib/agent-llm';
import { config } from '@/lib/config';
import { alertById } from '@/lib/data';
import { score } from '@/lib/score';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Simple per-instance limit so a public demo can't run up the API bill.
const hits = new Map<string, number[]>();
function limited(ip: string, max = 40) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > max;
}

export async function POST(req: Request) {
  let body: { alertId?: string; mode?: string; passcode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const { alertId = '', mode = '', passcode = '' } = body;
  if (!alertById.has(alertId)) return NextResponse.json({ error: 'Unknown alert' }, { status: 404 });
  if (mode !== 'jev' && mode !== 'llm') return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });

  const owner = !!config.runPasscode && passcode === config.runPasscode;
  if (!owner && !config.featuredAlerts.includes(alertId)) {
    return NextResponse.json({ error: 'Only the sample alerts can be run without the passcode.' }, { status: 403 });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!owner && limited(ip)) return NextResponse.json({ error: 'Too many runs. Try again later.' }, { status: 429 });

  try {
    const trace = mode === 'jev' ? await runJevAgent(alertId) : await runLlmAgent(alertId);
    return NextResponse.json({ trace, score: score(alertId, trace.decision) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
