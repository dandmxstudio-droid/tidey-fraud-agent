// The analyst's calls on alerts. A demo: kept in this browser tab only, nothing is sent anywhere.
import type { Action, Verdict } from './types';
import { DATASET } from './dataset';

export type Choice = 'approve' | 'override' | 'legit' | 'fraud' | 'contact' | 'confirm' | 'reopen';
export type Decided = { choice: Choice; at: string };
// Feedback follows the usual UI meaning, whatever the action was:
// success = the call went through, warning = the alert needs a person's attention again.
export type FeedbackState = 'success' | 'warning';

const KEY = `tidey-decisions-${DATASET}`;

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

// Handled alerts that are still open because they wait on someone else: the customer's reply, or the fraud team's second look.
export const stillOpen = (d?: Decided) => !!d && (d.choice === 'contact' || d.choice === 'reopen');

// What the analyst can do, by the group Tidey put the alert in.
export const CHOICES: Record<Action, { choice: Choice; label: string; cls: string }[]> = {
  escalate: [
    { choice: 'override', label: 'Not Fraud', cls: 'btn' },
    { choice: 'approve', label: 'Approve Block', cls: 'btn danger' },
  ],
  analyst: [
    { choice: 'legit', label: 'Mark Legitimate', cls: 'btn' },
    { choice: 'fraud', label: 'Escalate as Fraud', cls: 'btn danger' },
    { choice: 'contact', label: 'Contact Customer', cls: 'btn primary' },
  ],
  close: [
    { choice: 'reopen', label: 'Reopen', cls: 'btn' },
    { choice: 'confirm', label: 'Looks Right', cls: 'btn primary' },
  ],
};

// What happens after a call: what Tidey says while it works, and the result.
export function outcome(choice: Choice, verdict: Verdict): { working: string; title: string; body: string; short: string; state: FeedbackState } {
  const takeover = verdict === 'account_takeover';
  switch (choice) {
    case 'approve':
      return takeover
        ? { working: 'Freezing online banking and holding the transfer…', title: 'Account Frozen', body: 'Online banking is locked, the transfer is on hold, and Tidey asked the customer to call the bank to verify.', short: 'Account Frozen', state: 'success' }
        : { working: 'Blocking the card…', title: 'Card Blocked', body: 'Tidey blocked the card, ordered a replacement and texted the customer.', short: 'Card Blocked', state: 'success' };
    case 'override':
      return { working: 'Closing the alert…', title: 'Closed as Not Fraud', body: 'Nothing was blocked. Your call is logged next to Tidey’s, so the disagreement can be reviewed.', short: 'Closed, Not Fraud', state: 'success' };
    case 'legit':
      return { working: 'Closing the alert…', title: 'Closed as Legitimate', body: 'No action on the account. Your call is logged with Tidey’s notes.', short: 'Legitimate', state: 'success' };
    case 'fraud':
      return { working: 'Sending it to the fraud team…', title: 'Escalated as Fraud', body: 'The fraud team has the case with Tidey’s notes, and the card is on hold until they review it.', short: 'Escalated', state: 'success' };
    case 'contact':
      return { working: 'Texting the customer…', title: 'Customer Texted', body: 'Tidey asked the customer to confirm the activity. The alert stays open until they reply.', short: 'Customer Texted', state: 'success' };
    case 'confirm':
      return { working: 'Saving your check…', title: 'Spot-Checked', body: 'You agreed with Tidey’s close. It’s logged as checked.', short: 'Checked', state: 'success' };
    case 'reopen':
      return { working: 'Reopening…', title: 'Sent for a Second Look', body: 'Tidey’s close is marked as overturned, and the fraud team will review the alert.', short: 'Second Look', state: 'warning' };
  }
}
