import { config } from '@/lib/config';
import { VERDICT_CRITERIA } from '@/lib/agent-jev';
import { TOOLS, TOOL_NAMES } from '@/lib/tools';
import { VERDICT_LABEL } from '@/lib/labels';
import type { Verdict } from '@/lib/types';

export default function How() {
  return (
    <>
      <p className="kicker">How it works</p>
      <h1>Tidey: a fraud alert agent with clear jobs for each part</h1>
      <p className="lead">
        Fraud rules flag far more activity than is really fraud, and analysts spend their day clearing alerts. Tidey investigates each alert,
        closes the clear false alarms, escalates clear fraud, and sends anything uncertain to a person. Version A splits the work so each part does what
        it is best at. Version B lets one AI model do everything, as a baseline.
      </p>

      <h2>Version A: Jev decides, code acts</h2>
      <div className="flow" style={{ marginBottom: 22 }}>
        <div><span className="who code">Code</span><b>Read the alert</b>Pulls the alert and works out the facts: distance from home, new device or not, amount compared with the usual.</div>
        <div><span className="who jev">Jev</span><b>Choose the checks</b>Code always runs the required checks. Jev answers yes/no questions with probabilities on which extra checks are worth running.</div>
        <div><span className="who code">Code</span><b>Run the checks</b>Plain code reads the bank&apos;s records. No model does counting or math.</div>
        <div><span className="who jev">Jev</span><b>Answer the decision questions</b>Who did this, is anything out of character and unexplained, could it be a scam. Each answer comes with probabilities.</div>
        <div><span className="who code">Code</span> + <span className="who person">Person</span><b>Apply the rules</b>Code turns probabilities into close, escalate or send to an analyst. A person approves any card block. An AI model writes the summary they read.</div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>The code rules</h2>
          <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            <li><b>Close on its own</b> only if Jev picks legitimate with probability ≥ {config.closeAt} and the chance that something is out of character and unexplained is ≤ {config.unexplainedMax}.</li>
            <li><b>Escalate as fraud</b> if Jev picks a fraud type and the probability of fraud is ≥ {config.escalateAt}. A person approves any block or freeze.</li>
            <li><b>Everything else goes to an analyst</b> with a written summary.</li>
            <li><b>Guardrails:</b> never auto-close ${config.maxAutoCloseAmount.toLocaleString()} or more; scam risk ≥ {config.scamRiskAt} always goes to a person.</li>
            <li>Jev runs an optional check when it says the check is useful with probability ≥ {config.checkAt}.</li>
          </ul>
          <p className="small muted">The single-model version gets the same tools, the same definitions and the same ${config.maxAutoCloseAmount.toLocaleString()} guardrail, so the comparison is fair.</p>
        </div>
        <div className="card">
          <h2>What Jev is asked</h2>
          <div className="small">
            <p><b>Who most likely carried out this activity?</b> (pick one)</p>
            <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
              {(Object.keys(VERDICT_CRITERIA) as Verdict[]).map((k) => <li key={k}><b>{VERDICT_LABEL[k]}:</b> {VERDICT_CRITERIA[k]}</li>)}
            </ul>
            <p><b>Is anything out of character that the evidence doesn&apos;t explain?</b> (yes/no)</p>
            <p><b>Could the customer be the victim of a scam?</b> (yes/no)</p>
            <p className="muted">Each answer returns a probability for every option. Jev cannot return an answer outside these options.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>The checks (tools)</h2>
        <table className="list">
          <tbody>
            {TOOL_NAMES.map((n) => <tr key={n}><td style={{ width: 200 }}><b>{TOOLS[n].title}</b></td><td>{TOOLS[n].description}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>The test</h2>
        <p className="small" style={{ lineHeight: 1.6 }}>
          50 synthetic alerts for a fictional bank: 24 legitimate (travel, new phones, big but normal purchases, verified changes), 18 fraud (8 stolen
          cards used online, 5 account takeovers, 5 card-testing bursts) and 8 unclear cases with mixed signals that a person should see. Each alert has an
          answer key that neither version sees. A decision is correct when it closes a legitimate alert, escalates fraud, or sends an unclear case to a
          person. The costly mistake is fraud closed with nobody looking.
        </p>
      </div>
    </>
  );
}
