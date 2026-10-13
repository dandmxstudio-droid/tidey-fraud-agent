// Version B: one AI model does everything: picks the checks, decides, and writes the summary.
import { config, mockMode } from './config';
import { chat, type ChatMessage } from './openai';
import { alertContext, runTool, TOOL_NAMES, TOOLS } from './tools';
import { VERDICT_CRITERIA, actionLabel } from './agent-jev';
import type { Action, Step, ToolName, Trace, Verdict } from './types';

const SYSTEM = `You are a fraud investigation agent at a bank. You receive one fraud alert.
Use the tools to check the customer's records, then decide.

Verdicts:
${Object.entries(VERDICT_CRITERIA).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Actions:
- close: you are confident it is legitimate and every unusual thing is explained. The alert is closed with no person reviewing it.
- escalate: you are confident it is fraud. It goes to the fraud team, who approve any card block or freeze.
- analyst: anything unclear, mixed signals, or signs the customer may be being scammed. A person reviews it.
Never close an alert of $5,000 or more.

Use only the facts in the tool results. When you are done, answer in the required JSON format.`;

const SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'alert_decision',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['verdict', 'confidence', 'action', 'summary', 'recommendation'],
      properties: {
        verdict: { type: 'string', enum: Object.keys(VERDICT_CRITERIA) },
        confidence: { type: 'number', description: 'Your confidence in the verdict, from 0 to 1' },
        action: { type: 'string', enum: ['close', 'escalate', 'analyst'] },
        summary: { type: 'string', description: '2-3 short sentences for the analyst' },
        recommendation: { type: 'string', description: 'One recommended next step' },
      },
    },
  },
};

const TOOL_DEFS = TOOL_NAMES.map((n) => ({
  type: 'function',
  function: { name: n, description: TOOLS[n].description, parameters: { type: 'object', properties: {}, additionalProperties: false } },
}));

export async function runLlmAgent(alertId: string): Promise<Trace> {
  const t0 = Date.now();
  const steps: Step[] = [];
  const tokens = { jevIn: 0, openaiIn: 0, openaiOut: 0 };
  const models: Trace['models'] = {};
  const toolsUsed: ToolName[] = [];

  const ctx = alertContext(alertId);
  steps.push({ kind: 'context', label: 'Read the alert', detail: ctx.what_happened, data: ctx });

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: JSON.stringify({ alert: ctx }) },
  ];

  let final: { verdict: Verdict; confidence: number; action: Action; summary: string; recommendation: string } | null = null;
  let invalid = false;
  let error: string | undefined;

  try {
    for (let turn = 0; turn < config.maxLlmTurns; turn++) {
      const r = await chat({ messages, tools: TOOL_DEFS, response_format: SCHEMA }, { kind: 'agent', ctx, toolsUsed: [...toolsUsed], turn });
      tokens.openaiIn += r.usage.prompt_tokens;
      tokens.openaiOut += r.usage.completion_tokens;
      models.openai = r.model;
      const calls = r.message.tool_calls ?? [];
      if (calls.length) {
        messages.push({ role: 'assistant', content: r.message.content, tool_calls: calls });
        const names: string[] = [];
        const outs: Record<string, unknown> = {};
        for (const c of calls) {
          const n = c.function.name as ToolName;
          const out = TOOL_NAMES.includes(n) ? runTool(n, alertId) : { error: `Unknown tool ${n}` };
          if (TOOL_NAMES.includes(n) && !toolsUsed.includes(n)) toolsUsed.push(n);
          names.push(TOOLS[n]?.title ?? n);
          outs[TOOLS[n]?.title ?? n] = out;
          messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(out) });
        }
        steps.push({ kind: 'model', label: `AI model ran: ${names.join(', ')}`, ms: r.ms, data: outs });
        continue;
      }
      steps.push({ kind: 'decide', label: 'AI model made its decision', ms: r.ms });
      try {
        const j = JSON.parse(r.message.content ?? '');
        if (!['close', 'escalate', 'analyst'].includes(j.action) || !(j.verdict in VERDICT_CRITERIA)) throw new Error('bad values');
        final = j;
      } catch {
        invalid = true;
      }
      break;
    }
    if (!final && !invalid) invalid = true; // ran out of turns
  } catch (e) {
    error = (e as Error).message;
    invalid = true;
  }

  let action: Action = final?.action ?? 'analyst';
  let reason = final ? 'The AI model chose this action itself.' : 'No valid answer from the AI model, so the case defaults to an analyst.';
  if (final && action === 'close' && (ctx.approved_total || 0) >= 5000) {
    action = 'analyst';
    reason = 'The model tried to close an alert of $5,000 or more; the same guardrail sends it to an analyst.';
  }
  const verdict: Verdict = final?.verdict ?? 'legitimate';
  steps.push({ kind: 'rule', label: actionLabel(action, verdict), detail: reason });

  const totalMs = Date.now() - t0;
  const costUsd = (tokens.openaiIn / 1e6) * config.openaiPricePerMInput + (tokens.openaiOut / 1e6) * config.openaiPricePerMOutput;
  return {
    alertId, mode: 'llm', mock: mockMode(), models, steps, toolsUsed,
    decision: { action, verdict, confidence: final?.confidence ?? 0, reason },
    summary: final ? { text: final.summary, recommendation: final.recommendation } : undefined,
    costUsd, decisionMs: totalMs, totalMs, tokens, invalidOutput: invalid, error,
  };
}
