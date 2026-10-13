// All tunable settings in one place. Thresholds can also be set with environment variables in Vercel.

const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  // Models
  jevModel: process.env.JEV_MODEL || 'jev-latest',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini',

  // Code rules that turn Jev's probabilities into an action
  closeAt: num(process.env.CLOSE_AT, 0.85), // P(legitimate) needed to close an alert without a person
  explainedAt: num(process.env.EXPLAINED_AT, 0.7), // P(everything unusual is explained) needed to close
  escalateAt: num(process.env.ESCALATE_AT, 0.85), // P(fraud) needed to escalate as confirmed fraud
  scamRiskAt: num(process.env.SCAM_RISK_AT, 0.6), // P(customer may be being scammed) that forces a person to look
  maxAutoCloseAmount: num(process.env.MAX_AUTO_CLOSE_AMOUNT, 5000), // never auto-close at or above this amount
  checkAt: num(process.env.CHECK_AT, 0.5), // P(check is useful) needed for Jev to run an optional check

  // Prices in USD per 1M tokens. Update from your TypeSafe dashboard and OpenAI's pricing page.
  jevPricePerMInput: num(process.env.JEV_PRICE_PER_M_INPUT, 0.042),
  openaiPricePerMInput: num(process.env.OPENAI_PRICE_PER_M_INPUT, 0.75),
  openaiPricePerMOutput: num(process.env.OPENAI_PRICE_PER_M_OUTPUT, 4.5),

  // Access
  runPasscode: process.env.RUN_PASSCODE || '',
  // Alerts anyone can run live from the public site (mix of types)
  featuredAlerts: ['A-1036', 'A-1001', 'A-1006', 'A-1009', 'A-1042'],

  maxLlmTurns: 8,
};

export function mockMode(): boolean {
  if (process.env.MOCK_MODE === '1') return true;
  return !process.env.TYPESAFE_API_KEY || !process.env.OPENAI_API_KEY;
}
