# Wes · Fraud alert agent for Demo Bank (fictional)

Wes is a fraud alert investigation agent, built two ways and tested head to head on 50 synthetic alerts.

- **Version A: Jev decides, code acts.** Code reads the alert and always runs the required checks. [Jev](https://docs.typesafe.ai) (TypeSafe's decision model) answers yes/no questions on which extra checks to run, then answers the decision questions with probabilities. Plain code rules turn those probabilities into **close**, **escalate** or **send to an analyst**. An AI model writes the summary a person reads.
- **Version B: one AI model does everything.** The same checks as tools, the same definitions and the same guardrail, but the model picks the checks and makes the call itself.

Both versions are scored against an answer key neither one sees (`data/answer_key.json`, read only by `lib/score.ts`).

**All data is synthetic. Demo Bank is fictional.**

## The test set
50 alerts: 24 legitimate, 18 fraud (8 stolen cards used online, 5 account takeovers, 5 card-testing bursts), 8 unclear cases with mixed signals that a person should see. The generator is in `gen/generate.py`.

A decision is **correct** when it closes a legitimate alert, escalates fraud, or sends an unclear case to a person. The costly mistake is **fraud closed with no person looking**.

## Code rules (version A)
Set in `lib/config.ts`, or override with environment variables:

| Rule | Default | Env var |
|---|---|---|
| Close only if P(legitimate) ≥ | 0.85 | `CLOSE_AT` |
| …and P(everything explained) ≥ | 0.70 | `EXPLAINED_AT` |
| Escalate if P(fraud) ≥ | 0.85 | `ESCALATE_AT` |
| Scam risk that forces a person | 0.60 | `SCAM_RISK_AT` |
| Never auto-close at or above | $5,000 | `MAX_AUTO_CLOSE_AMOUNT` |
| Run an optional check if P(useful) ≥ | 0.50 | `CHECK_AT` |

## Setup (Vercel)
Environment variables:

| Name | What |
|---|---|
| `TYPESAFE_API_KEY` | Your Jev API key |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `RUN_PASSCODE` | Any passcode you choose. Needed to run all 50 alerts. Visitors can only run the 5 sample alerts. |
| `OPENAI_MODEL` | Optional. Default `gpt-5.4-mini` |
| `JEV_MODEL` | Optional. Default `jev-latest` (the model version used is logged on every case) |

Without both API keys the app runs in **mock mode** with simple stand-in rules and shows a banner. Mock numbers are not results.

## Running the test
1. Open the site, enter the passcode, press **Run all 50**.
2. When it finishes, press **Download results** and commit the file as `public/results/official.json`. The site then shows it as the official run.

## Local
```
npm install
npm run dev            # mock mode unless keys are set in .env.local
npm run test:offline   # runs both versions of Wes on all 50 alerts in mock mode
```
