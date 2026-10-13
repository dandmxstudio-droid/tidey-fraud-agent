import keyJson from '@/data/answer_key.json';
import example from '@/lib/example-case.json';
import { config } from '@/lib/config';
import { VERDICT_CRITERIA } from '@/lib/agent-jev';
import { toolHeadline } from '@/lib/headlines';
import { TOOLS, TOOL_NAMES } from '@/lib/tools';
import { VERDICT_LABEL, actionText, money } from '@/lib/labels';
import type { Action, AnswerKey, ToolName, Verdict } from '@/lib/types';
import { Pipeline, type PipeStep } from './pipeline';

const ALWAYS: Partial<Record<ToolName, string>> = { transaction_history: 'Always runs', payee_details: 'Always for transfers', account_changes: 'Always for transfers' };
const TITLE_TO_TOOL = Object.fromEntries(TOOL_NAMES.map((n) => [TOOLS[n].title, n])) as Record<string, ToolName>;

// The walkthrough uses one real investigation from the development test run (lib/example-case.json).
function exampleSteps(): PipeStep[] {
  const ctx = example.context;
  const t = ctx.triggering_activity[ctx.triggering_activity.length - 1];
  const plan = Object.entries(example.plan as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const verdict = Object.entries(example.decide.verdict as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const d = example.decision as { action: Action; verdict: Verdict };
  return [
    {
      lane: 'code', title: 'Read the alert',
      body: 'Plain code pulls the alert and works out the facts before any model sees it: how far from home, whether the device is new, how the amount compares with normal.',
      example: { kind: 'facts', rows: [
        ['What happened', `${money(t.amount)} ${t.channel} purchase at ${t.merchant}`],
        ['When', `${t.time.slice(11)}, a ${t.hour_of_day < 6 ? 'middle-of-the-night' : 'daytime'} purchase`],
        ['Where', `${t.location}, ${t.distance_from_home_miles.toLocaleString()} miles from home in ${ctx.customer.home_city}`],
        ['Device', `${t.device.label}, first seen that day`],
        ['Amount', `${t.times_customer_average_purchase} times the usual ${money(ctx.customer_average_purchase_90d)}`],
      ] },
    },
    {
      lane: 'jev', title: 'Choose the checks',
      body: `Some checks always run. For each of the others, Jev answers one yes or no question: is this check worth running? Code runs it when the answer is yes with probability ${config.checkAt} or more.`,
      example: { kind: 'bars', question: 'Is this check worth running?', threshold: config.checkAt,
        rows: plan.map(([k, v]) => ({ label: TOOLS[k as ToolName].title, value: v, tag: v >= config.checkAt ? 'Runs' : 'Skipped' })),
        foot: 'Transaction history always runs.' },
    },
    {
      lane: 'code', title: 'Run the checks',
      body: 'Code reads the bank’s records for each chosen check. No model counts, adds up or looks anything up, so the facts are exact.',
      example: { kind: 'lines', rows: example.tools.map((x) => ({ label: x.label, text: toolHeadline(TITLE_TO_TOOL[x.label], x.data as Record<string, unknown>) })) },
    },
    {
      lane: 'jev', title: 'Answer the decision questions',
      body: 'Jev reads the alert and the evidence and answers fixed questions. Every option gets a probability, so the next step has numbers to work with instead of prose.',
      example: { kind: 'bars', question: 'Who most likely carried out this activity?',
        rows: [...verdict.map(([k, v]) => ({ label: VERDICT_LABEL[k as Verdict], value: v })), { label: 'Could it be a scam?', value: example.decide.scam_risk }] },
    },
    {
      lane: 'code', title: 'Apply the rules',
      body: 'Code turns the probabilities into one of three outcomes: close the alert, escalate it as fraud, or send it to an analyst. The same numbers always give the same outcome.',
      example: { kind: 'outcome', pill: actionText(d.action, d.verdict), text: example.rule },
    },
    {
      lane: 'ai', title: 'Write the summary',
      body: 'For anything Tidey doesn’t close, an AI model writes the summary and the suggested next step the analyst reads. It writes; it doesn’t decide.',
      example: { kind: 'quote', text: example.summary.text, rec: example.summary.recommendation },
    },
    {
      lane: 'person', title: 'Approve or decide',
      body: 'A person approves every card block or account freeze, and makes the call on every case Tidey wasn’t sure about.',
      example: { kind: 'approve', title: 'Tidey found a stolen card used online', body: 'Nothing happens to the card until an analyst approves the block.' },
    },
  ];
}

export default function How() {
  const key = keyJson as AnswerKey[];
  const n = (f: (k: AnswerKey) => boolean) => key.filter(f).length;
  const legit = n((k) => k.label === 'legitimate');
  const unclear = n((k) => k.label === 'unclear');
  const fraud = key.length - legit - unclear;
  const limit = `$${config.maxAutoCloseAmount.toLocaleString()}`;
  const esc = 1 - config.escalateAt; // legit probability at or below which a fraud verdict escalates
  const exLegit = (example.decide.verdict as Record<string, number>).legitimate;

  return (
    <>
      <p className="kicker">How it works</p>
      <h1>Each part of Tidey has one job</h1>
      <p className="lead">
        Jev makes the judgment calls, plain code does everything that has to be exact, an AI model writes for people, and a person keeps the final say.
        Follow one real alert from the test as it moves through.
      </p>

      <Pipeline steps={exampleSteps()} alertLabel={`alert ${example.alertId}, a real case from the test`} />

      <section className="section">
        <div className="section-head">
          <h2>Where the lines are drawn</h2>
          <p>Jev only answers questions. These rules, written in plain code, decide what happens with the answers. They’re the same for every alert, so every outcome traces back to a number.</p>
        </div>
        <div className="scale-card">
          <p className="scale-q">How likely Jev thinks the activity is legitimate</p>
          <div className="scale" style={{ gridTemplateColumns: `${esc}fr ${config.closeAt - esc}fr ${1 - config.closeAt}fr` }}>
            <div className="zone escalate"><b>Escalate as fraud</b><span>A person approves any block</span></div>
            <div className="zone analyst"><b>Send to an analyst</b><span>With a summary and a next step</span></div>
            <div className="zone close"><b>Close it alone</b><span>Only if the checks below pass</span></div>
            <span className="marker" style={{ left: `${exLegit * 100}%` }}><i />{example.alertId}</span>
          </div>
          <div className="scale-ticks">
            <span style={{ left: '0%' }}>0</span>
            <span style={{ left: `${esc * 100}%` }}>{esc.toFixed(2)}</span>
            <span style={{ left: `${config.closeAt * 100}%` }}>{config.closeAt}</span>
            <span style={{ left: '100%' }}>1</span>
          </div>
          <div className="gates">
            <div>
              <b>To close it alone, Tidey also needs</b>
              <ul>
                <li>The chance that something is out of character and unexplained at <span className="num-chip">{config.unexplainedMax}</span> or less</li>
                <li>An amount under <span className="num-chip">{limit}</span></li>
                <li>A scam risk under <span className="num-chip">{config.scamRiskAt}</span></li>
              </ul>
            </div>
            <div>
              <b>Anything that misses a rule</b>
              <p>Goes to an analyst. When Tidey isn’t sure, a person decides, which is the safe way to be wrong.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>What Jev is asked</h2>
          <p>Three questions with fixed options. Jev returns a probability for every option and can’t answer outside them, so there is nothing to parse or repair.</p>
        </div>
        <div className="asks">
          <div className="ask big">
            <p className="ask-type">Pick one</p>
            <h3>Who most likely carried out this activity?</h3>
            <div className="ask-opts">
              {(Object.keys(VERDICT_CRITERIA) as Verdict[]).map((k) => (
                <div key={k}><b>{VERDICT_LABEL[k]}</b><span>{VERDICT_CRITERIA[k]}</span></div>
              ))}
            </div>
            <p className="ask-use">Places the alert on the scale above.</p>
          </div>
          <div className="ask">
            <p className="ask-type">Yes or no</p>
            <h3>Is anything out of character that the evidence doesn’t explain?</h3>
            <p className="ask-use">Tidey only closes an alert when this is {config.unexplainedMax} or less.</p>
          </div>
          <div className="ask">
            <p className="ask-type">Yes or no</p>
            <h3>Could the customer be the victim of a scam?</h3>
            <p className="ask-use">At {config.scamRiskAt} or more, a person always sees it.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>The checks</h2>
          <p>Six read-only lookups into the bank’s records. Both versions of the agent in the test get exactly the same ones.</p>
        </div>
        <div className="check-grid">
          {TOOL_NAMES.map((t) => (
            <div key={t}>
              <b>{TOOLS[t].title}</b>
              {ALWAYS[t] && <span className="tag">{ALWAYS[t]}</span>}
              <p>{TOOLS[t].description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>The test</h2>
          <p>
            {key.length} synthetic alerts for a fictional bank: {legit} legitimate, {fraud} fraud and {unclear} unclear cases with mixed signals that a person should see.
            Each has an answer key that neither version sees. The comparison is the same agent built the obvious way, with one AI model ({config.openaiModel}) choosing checks and
            deciding everything, with the same tools and the same {limit} limit.
          </p>
        </div>
        <div className="test-facts">
          <div><b>A right call</b><p>Closes a legitimate alert, escalates fraud, or sends an unclear case to a person.</p></div>
          <div><b>The costly mistake</b><p>Fraud, or an unclear case, closed with nobody looking.</p></div>
          <div><b>The results</b><p>Every decision, scored, on the <a href="/proof">Test results</a> page.</p></div>
        </div>
      </section>
    </>
  );
}
