import keyJson from '@/data/answer_key.json';
import { config } from '@/lib/config';
import { VERDICT_CRITERIA } from '@/lib/agent-jev';
import { TOOLS, TOOL_NAMES } from '@/lib/tools';
import { VERDICT_LABEL } from '@/lib/labels';
import type { AnswerKey, ToolName, Verdict } from '@/lib/types';

type Who = 'code' | 'jev' | 'ai' | 'person';
const WHO: Record<Who, string> = { code: 'Code', jev: 'Jev', ai: 'AI model', person: 'Person' };

const STEPS: { who: Who[]; title: string; body: string }[] = [
  { who: ['code'], title: 'Read the alert', body: 'Pulls the alert and works out the facts: how far from home it happened, whether the device is new, and how the amount compares with what the customer usually spends.' },
  { who: ['jev'], title: 'Choose the checks', body: `Some checks always run. For each of the others, Jev answers a yes or no question about whether it is worth running, and code runs it when the answer is yes with probability ${config.checkAt} or more.` },
  { who: ['code'], title: 'Run the checks', body: 'Plain code reads the bank’s records. No model counts, adds up or looks anything up.' },
  { who: ['jev'], title: 'Answer the decision questions', body: 'Who most likely did this, whether anything is out of character and unexplained, and whether the customer could be the victim of a scam. Every answer comes with a probability for each option.' },
  { who: ['code'], title: 'Apply the rules', body: 'Code turns those probabilities into one of three outcomes: close the alert, escalate it as fraud, or send it to an analyst.' },
  { who: ['ai', 'person'], title: 'Write it up and decide', body: 'For anything Tidey doesn’t close, an AI model writes the summary the analyst reads. A person approves every card block or account freeze.' },
];

const ALWAYS: Partial<Record<ToolName, string>> = { transaction_history: 'Always runs', payee_details: 'Always runs for transfers', account_changes: 'Always runs for transfers' };

function Chips({ who }: { who: Who[] }) {
  return <span className="chips">{who.map((w) => <span key={w} className={`who-chip ${w}`}>{WHO[w]}</span>)}</span>;
}

export default function How() {
  const key = keyJson as AnswerKey[];
  const n = (f: (k: AnswerKey) => boolean) => key.filter(f).length;
  const legit = n((k) => k.label === 'legitimate');
  const unclear = n((k) => k.label === 'unclear');
  const fraud = key.length - legit - unclear;
  const v = (x: number | string) => <span className="num-chip">{x}</span>;
  const limit = `$${config.maxAutoCloseAmount.toLocaleString()}`;

  return (
    <div className="longform">
      <p className="kicker">How it works</p>
      <h1>Each part of Tidey has one job</h1>
      <p className="lead">
        Bank fraud rules flag far more activity than is really fraud, and analysts spend their days clearing alerts. Tidey investigates each one, closes the clear
        false alarms, lines up clear fraud for approval, and sends anything uncertain to a person. Jev makes the judgment calls, code does everything that has to be exact,
        and a person keeps the final say.
      </p>

      <section className="section">
        <div className="section-head">
          <h2>The investigation, step by step</h2>
          <p>Every alert goes through the same six steps. Each step names who does it.</p>
        </div>
        <ol className="steps-v">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <div className="step-title">
                <span className="num">{i + 1}</span>
                <div><Chips who={s.who} /><h3>{s.title}</h3></div>
              </div>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>The rules code applies</h2>
          <p>Jev only answers questions. These rules, written in plain code, decide what happens with the answers, so every outcome can be traced to a number.</p>
        </div>
        <dl className="rules">
          <div><dt>Close it alone</dt><dd>Jev picks legitimate with probability {v(config.closeAt)} or more, and the chance that something is out of character and unexplained is {v(config.unexplainedMax)} or less.</dd></div>
          <div><dt>Escalate as fraud</dt><dd>Jev picks a fraud type and the probability of fraud is {v(config.escalateAt)} or more. A person approves any block or freeze.</dd></div>
          <div><dt>Send to an analyst</dt><dd>Everything else, with a written summary and a suggested next step.</dd></div>
          <div><dt>Never closed alone</dt><dd>Alerts of {v(limit)} or more, and any alert where the chance of a scam is {v(config.scamRiskAt)} or more.</dd></div>
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>What Jev is asked</h2>
          <p>Three questions with fixed options. Jev returns a probability for every option and can’t answer outside them, so there is nothing to parse or repair.</p>
        </div>
        <div className="qa">
          <div className="qq">
            <h3>Who most likely carried out this activity?<span className="type">Pick one</span></h3>
            <div className="opts">
              {(Object.keys(VERDICT_CRITERIA) as Verdict[]).map((k) => (
                <div key={k} className="opt-row"><b>{VERDICT_LABEL[k]}</b><span>{VERDICT_CRITERIA[k]}</span></div>
              ))}
            </div>
          </div>
          <div className="qq"><h3>Is anything out of character that the evidence doesn’t explain?<span className="type">Yes or no</span></h3></div>
          <div className="qq"><h3>Could the customer be the victim of a scam?<span className="type">Yes or no</span></h3></div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>The checks</h2>
          <p>Six read-only lookups into the bank’s records. Both versions of the agent get exactly the same ones.</p>
        </div>
        <div className="checks">
          {TOOL_NAMES.map((t) => (
            <div key={t}>
              <b>{TOOLS[t].title}{ALWAYS[t] && <span className="tag">{ALWAYS[t]}</span>}</b>
              <span>{TOOLS[t].description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>The test</h2>
          <p>
            {key.length} synthetic alerts for a fictional bank: {legit} legitimate (travel, new phones, big but normal purchases, verified changes), {fraud} fraud
            (stolen cards used online, account takeovers and card-testing bursts) and {unclear} unclear cases with mixed signals that a person should see. Each alert has an answer key
            that neither version sees.
          </p>
        </div>
        <dl className="rules">
          <div><dt>A correct decision</dt><dd>Closes a legitimate alert, escalates fraud, or sends an unclear case to a person.</dd></div>
          <div><dt>The costly mistake</dt><dd>Fraud closed with nobody looking.</dd></div>
          <div><dt>The comparison</dt><dd>The same agent built the obvious way, with one AI model ({config.openaiModel}) choosing checks and deciding everything. Same tools, same definitions, same {limit} limit. See the <a href="/proof">test results</a>.</dd></div>
        </dl>
      </section>
    </div>
  );
}
