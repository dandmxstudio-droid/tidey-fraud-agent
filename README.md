# Tidey · Fraud alert agent for Tidewell (fictional bank)

Tidey is a fraud alert investigation agent, built two ways and tested head to head on 50 synthetic alerts.

- **Version A: Jev decides, code acts.** Code reads the alert and always runs the required checks. [Jev](https://docs.typesafe.ai) (TypeSafe's decision model) answers yes/no questions on which extra checks to run, then answers the decision questions with probabilities. Plain code rules turn those probabilities into **close**, **escalate** or **send to an analyst**. An AI model writes the summary a person reads.
- **Version B: one AI model does everything.** A single OpenAI model (GPT-5.4 mini) gets the same checks as tools, the same definitions and the same guardrail, but picks the checks and makes the call itself.

Both versions are scored against an answer key neither one sees (`data/answer_key.json`, read only by `lib/score.ts`).

**All data is synthetic. Tidewell is fictional.**

## Development set and test set
Two sets of 50 synthetic alerts, each with 24 legitimate, 18 fraud (8 stolen cards used online, 5 account takeovers, 5 card-testing bursts) and 8 unclear cases with mixed signals that a person should see. Both come from `gen/generate.py`.

- **Development set** (`results-archive/dev-data/`, `python3 gen/generate.py`): the alerts Tidey's questions and rules were tuned on.
  - v1 run (`results-archive/dev-run-v1.json`): Tidey 31/50 correct, 0 risky alerts closed alone; GPT-5.4 mini 47/50, 2 closed alone. Tidey sent 19 legitimate alerts to a person: the yes/no question "is everything explained?" was read too literally.
  - v2 run (`results-archive/dev-run-v2.json`), with the question turned around to "is anything out of character and unexplained?": Tidey 45/50, 0 closed alone, 5 extra reviews; GPT-5.4 mini 47/50, 2 closed alone.
  - Tuning after v2: three legitimate alerts sat just over the unexplained limit (0.31 to 0.34) while the closest risky alert was at 0.46, so the limit moved from 0.30 to 0.35. Replayed on the stored v2 probabilities: 48/50, 0 closed alone.
- **Test set** (`data/`, `SET=test python3 gen/generate.py`): generated after tuning, with a new seed, different places, merchants and amounts, and 8 new mixed-signal cases. Nothing was tuned on it. The official results are from this set.

A decision is **correct** when it closes a legitimate alert, escalates fraud, or sends an unclear case to a person. The costly mistake is **a fraud or unclear alert closed with no person looking**.

## Code rules (version A)
Set in `lib/config.ts`, or override with environment variables:

| Rule | Default | Env var |
|---|---|---|
| Close only if P(legitimate) ≥ | 0.85 | `CLOSE_AT` |
| …and P(out of character and unexplained) ≤ | 0.35 | `UNEXPLAINED_MAX` |
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
1. Open the queue (home page), scroll to **Run the test yourself**, enter the passcode and press **Run all 50**.
2. When it finishes, press **Download your live run** and commit the file as `public/results/official.json`. The site then shows it as the official run.

## Local
```
npm install
npm run dev            # mock mode unless keys are set in .env.local
npm run test:offline   # runs both versions of Tidey on all 50 alerts in mock mode
```
