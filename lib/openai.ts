// Minimal OpenAI Chat Completions client with retries.
import { config, mockMode } from './config';
import { mockChat } from './mock';

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ChatResult = { message: { content: string | null; tool_calls?: ToolCall[] }; usage: { prompt_tokens: number; completion_tokens: number }; model: string; ms: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function chat(body: { messages: ChatMessage[]; tools?: unknown[]; response_format?: unknown; max_completion_tokens?: number }, mockHint?: unknown): Promise<ChatResult> {
  const t0 = Date.now();
  if (mockMode()) {
    const r = mockChat(body, mockHint);
    await sleep(900 + Math.random() * 1600);
    return { ...r, ms: Date.now() - t0 };
  }
  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.openaiModel, max_completion_tokens: 4000, ...body }),
    });
    if (res.ok) {
      const j = await res.json();
      return { message: j.choices[0].message, usage: j.usage ?? { prompt_tokens: 0, completion_tokens: 0 }, model: j.model, ms: Date.now() - t0 };
    }
    if (res.status === 401) throw new Error('OpenAI rejected the API key (401). Check OPENAI_API_KEY in Vercel: it should be an OpenAI key that starts with "sk-".');
    lastErr = `${res.status} ${await res.text()}`;
    if (res.status === 429 || res.status >= 500) {
      await sleep(600 * 2 ** attempt);
      continue;
    }
    break;
  }
  throw new Error(`OpenAI request failed: ${lastErr.slice(0, 300)}`);
}
