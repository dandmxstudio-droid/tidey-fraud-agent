export type Customer = { id: string; name: string; home_city: string; customer_since: string; account_type: string };
export type Transaction = {
  id: string; customer_id: string; timestamp: string; amount: number; merchant_id: string | null;
  channel: 'in_store' | 'online' | 'atm' | 'transfer'; status: 'approved' | 'declined';
  city?: string; device_id?: string | null; ip_city?: string; memo?: string; payee_id?: string;
};
export type Device = { id: string; customer_id: string; label: string; first_seen: string; last_seen: string };
export type SecurityEvent = { id: string; customer_id: string; timestamp: string; type: string; device_id: string | null; ip_city: string; details?: string };
export type Payee = { id: string; customer_id: string; name: string; added_at: string };
export type PriorAlert = { id: string; customer_id: string; date: string; rule: string; outcome: string };
export type Merchant = { id: string; name: string; category: string; online: boolean; fraud_reports_90d: number };
export type City = { name: string; lat: number; lon: number };
export type Alert = {
  id: string; customer_id: string; created_at: string; rule_triggered: string;
  trigger: { type: string; ids: string[] }; what_happened: string; amount: number;
};
export type AnswerKey = {
  alert_id: string; label: 'legitimate' | 'card_not_present_fraud' | 'account_takeover' | 'card_testing' | 'unclear';
  needs_human: boolean; expected_action: Action; why: string; leans?: string;
};

export type Action = 'close' | 'escalate' | 'analyst';
export type Verdict = 'legitimate' | 'card_not_present_fraud' | 'account_takeover' | 'card_testing';
export type Mode = 'jev' | 'llm';
export type ToolName = 'transaction_history' | 'devices_and_signins' | 'account_changes' | 'prior_alerts' | 'merchant_profile' | 'payee_details';

export type Step = { kind: 'context' | 'plan' | 'tool' | 'decide' | 'rule' | 'summary' | 'model'; label: string; ms?: number; detail?: string; data?: unknown };

export type Decision = { action: Action; verdict: Verdict; confidence: number; reason: string };

export type Trace = {
  alertId: string;
  mode: Mode;
  mock: boolean;
  models: { jev?: string; openai?: string };
  steps: Step[];
  toolsUsed: ToolName[];
  jev?: { plan?: Record<string, unknown>; decision?: Record<string, unknown> };
  decision: Decision;
  summary?: { text: string; recommendation: string };
  costUsd: number;
  decisionMs: number;
  totalMs: number;
  tokens: { jevIn: number; openaiIn: number; openaiOut: number };
  invalidOutput: boolean;
  error?: string;
};

export type Score = {
  label: AnswerKey['label'];
  needsHuman: boolean;
  expectedAction: Action;
  why: string;
  correct: boolean;
  missedFraud: boolean;
  unnecessaryReview: boolean;
  typeCorrect: boolean | null;
};

export type RunResult = { trace: Trace; score: Score };
