// Offline check of the engine in mock mode (no keys, no network): npm run test:offline
import { runJevAgent } from '@/lib/agent-jev';
import { runLlmAgent } from '@/lib/agent-llm';
import { alerts } from '@/lib/data';
import { score } from '@/lib/score';
import { summarizeRun } from '@/lib/summary';
import type { RunResult } from '@/lib/types';

async function main() {
  const out: { alertId: string; jev: RunResult; llm: RunResult }[] = [];
  const only = process.argv[2];
  for (const a of alerts.filter((x) => !only || x.id === only)) {
    const j = await runJevAgent(a.id);
    const l = await runLlmAgent(a.id);
    out.push({ alertId: a.id, jev: { trace: j, score: score(a.id, j.decision) }, llm: { trace: l, score: score(a.id, l.decision) } });
    process.stdout.write('.');
  }
  console.log();
  console.log(JSON.stringify({ jev: summarizeRun(out.map((r) => r.jev)), llm: summarizeRun(out.map((r) => r.llm)) }, null, 1));
  if (only) console.log(JSON.stringify(out[0], null, 1).slice(0, 6000));
}
main();
