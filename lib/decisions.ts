// The analyst's calls on alerts. A demo: kept in this browser tab only, nothing is sent anywhere.
import type { Action, Verdict } from './types';

export type Choice = 'approve' | 'override' | 'legit' | 'fraud' | 'contact' | 'confirm' | 'reopen';
export type Decided = { choice: Choice; at: string };
export type Tone = 'escalate' | 'close' | 'ocean' | 'review';

const KEY = 'tidey-decisions';

export function loadDecisions(): Record<string, Decided> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<string, Decided>;
  } catch {
    return {};
  }
}

export function saveDecision(id: string, d: Decided | null): Record<string, Decided> {
  const all = loadDecisions();
  if (d) all[id] = d;
  else delete all[id];
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: the call still shows on this page */
  }
  return all;
}

// What the analyst can do, by the group Tidey put the alert in.
export const CHOICES: Record<Action, { choice: Choice; label: string; cls: string }[]> = {
  escalate: [
    { choice: 'approve', label: 'Approve block', cls: 'btn danger' },
    { choice: 'override', label: 'Not fraud', cls: 'btn' },
  ],
  analyst: [
    { choice: 'legit', label: 'Mark legitimate', cls: 'btn' },
    { choice: 'fraud', label: 'Escalate as fraud', cls: 'btn danger' },
    { choice: 'contact', label: 'Contact customer', cls: 'btn primary' },
  ],
  close: [
    { choice: 'confirm', label: 'Looks right', cls: 'btn primary' },
    { choice: 'reopen', label: 'Reopen', cls: 'btn' },
  ],
};

// What happens after a call: what Tidey says while it works, and the result.
export function outcome(choice: Choice, verdict: Verdict): { working: string; title: string; body: string; short: string; tone: Tone } {
  const takeover = verdict === 'account_takeover';
  switch (choice) {
    case 'approve':
      return takeover
        ? { working: 'Freezing online banking and holding the transfer…', title: 'Account frozen', body: 'Online banking is locked, the transfer is on hold, and Tidey asked the customer to call the bank to verify.', short: 'Account frozen', tone: 'escalate' }
        : { working: 'Blocking the card…', title: 'Card blocked', body: 'Tidey blocked the card, ordered a replacement and texted the customer.', short: 'Card blocked', tone: 'escalate' };
    case 'override':
      return { working: 'Closing the alert…', title: 'Closed as not fraud', body: 'Nothing was blocked. Your call is logged next to Tidey’s, so the disagreement can be reviewed.', short: 'Closed, not fraud', tone: 'close' };
    case 'legit':
      return { working: 'Closing the alert…', title: 'Closed as legitimate', body: 'No action on the account. Your call is logged with Tidey’s notes.', short: 'Legitimate', tone: 'close' };
    case 'fraud':
      return { working: 'Sending it to the fraud team…', title: 'Escalated as fraud', body: 'The fraud team has the case with Tidey’s notes, and the card is on hold until they review it.', short: 'Escalated', tone: 'escalate' };
    case 'contact':
      return { working: 'Texting the customer…', title: 'Customer contacted', body: 'Tidey texted the customer to confirm the activity. The alert stays open until they reply.', short: 'Waiting on customer', tone: 'ocean' };
    case 'confirm':
      return { working: 'Saving your check…', title: 'Spot-checked', body: 'You agreed with Tidey’s close. It’s logged as checked.', short: 'Checked', tone: 'close' };
    case 'reopen':
      return { working: 'Reopening…', title: 'Reopened', body: 'Tidey’s close is marked as overturned and the alert is flagged for a second look.', short: 'Reopened', tone: 'review' };
  }
}
