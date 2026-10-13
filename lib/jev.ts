// Minimal TypeSafe Jev client (POST /v1/systemone). Docs: https://docs.typesafe.ai/api
import { config, mockMode } from './config';
import { mockJev } from './mock';

export type JevQuestion =
  | { type: 'noul'; instructions: string | object; criteria?: { true?: string; false?: string } }
  | { type: 'choice'; instructions: string | object; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: string | object; criteria: string[] };

export type JevAnswer = {
  type: 'noul' | 'choice' | 'score';
  noul?: number;
  choice?: string;
  score?: number;
  confidence?: number;
  probabilities?: Record<string, number>;
};

export type JevResult = { model: string; answers: Record<string, JevAnswer>; usage: { input_tokens: number; output_tokens: number }; ms: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function jev(state: unknown, questions: Record<string, JevQuestion>): Promise<JevResult> {
  const t0 = Date.now();
  if (mockMode()) {
    const r = mockJev(state, questions);
    await sleep(60 + Math.random() * 80);
    return { ...r, ms: Date.now() - t0 };
  }
  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, model: config.jevModel, questions }),
    });
    if (res.ok) {
      const j = await res.json();
      return { model: j.model, answers: j.answers, usage: j.usage ?? { input_tokens: 0, output_tokens: 0 }, ms: Date.now() - t0 };
    }
    lastErr = `${res.status} ${await res.text()}`;
    if (res.status === 429 || res.status === 529 || res.status >= 500) {
      await sleep(400 * 2 ** attempt);
      continue;
    }
    break;
  }
  throw new Error(`Jev request failed: ${lastErr.slice(0, 300)}`);
}
