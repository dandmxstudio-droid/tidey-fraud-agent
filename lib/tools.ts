// Investigation tools. Plain code over the bank's (synthetic) records.
// Tools only see data from before the alert, and they do the counting and math,
// so the models only have to judge, never calculate.
import {
  alertById, cityByName, customerById, deviceById, devicesByCustomer, eventsByCustomer, merchantById,
  payeeById, payeesByCustomer, priorByCustomer, txByCustomer, txById,
} from './data';
import type { Alert, ToolName, Transaction } from './types';

const fmt = (iso: string) => iso.replace('T', ' ').slice(0, 16);
const day = (iso: string) => iso.slice(0, 10);
const money = (n: number) => Math.round(n * 100) / 100;
const PROXY = 'Unknown (anonymizing proxy)';

function miles(a: string | undefined, b: string | undefined): number | null {
  if (!a || !b) return null;
  const A = cityByName.get(a), B = cityByName.get(b);
  if (!A || !B) return null;
  const r = 3958.8, rad = Math.PI / 180;
  const dLat = (B.lat - A.lat) * rad, dLon = (B.lon - A.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * rad) * Math.cos(B.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)));
}

const merchantName = (t: Transaction) => (t.merchant_id ? merchantById.get(t.merchant_id)?.name ?? t.merchant_id : t.payee_id ? `Transfer to ${payeeById.get(t.payee_id)?.name ?? 'payee'}` : 'Unknown');
const location = (t: Transaction) => t.city ?? t.ip_city ?? null;
const isPurchase = (t: Transaction) => t.channel === 'in_store' || t.channel === 'online';

export function getAlert(alertId: string): Alert {
  const a = alertById.get(alertId);
  if (!a) throw new Error(`Unknown alert ${alertId}`);
  return a;
}

function triggerTxs(a: Alert) {
  return a.trigger.ids.map((id) => txById.get(id)).filter(Boolean) as Transaction[];
}

function history(a: Alert) {
  const trig = new Set(a.trigger.ids);
  const first = triggerTxs(a).map((t) => t.timestamp).sort()[0] ?? a.created_at;
  const start = new Date(new Date(first).getTime() - 90 * 864e5).toISOString().slice(0, 19);
  return (txByCustomer.get(a.customer_id) ?? []).filter((t) => !trig.has(t.id) && t.timestamp < first && t.timestamp >= start);
}

/** Always run first: the alert, the customer, and plain facts about what triggered it. */
export function alertContext(alertId: string) {
  const a = getAlert(alertId);
  const c = customerById.get(a.customer_id)!;
  const hist = history(a).filter(isPurchase);
  const avg = hist.length ? hist.reduce((s, t) => s + t.amount, 0) / hist.length : 0;
  const alertDay = day(a.created_at);
  const items = triggerTxs(a).map((t) => {
    const m = t.merchant_id ? merchantById.get(t.merchant_id) : undefined;
    const d = t.device_id ? deviceById.get(t.device_id) : undefined;
    const loc = location(t);
    return {
      time: fmt(t.timestamp),
      hour_of_day: Number(t.timestamp.slice(11, 13)),
      amount: t.amount,
      status: t.status,
      channel: t.channel,
      merchant: m?.name ?? null,
      merchant_category: m?.category ?? null,
      payee: t.payee_id ? payeeById.get(t.payee_id)?.name ?? null : null,
      location: loc,
      distance_from_home_miles: loc === PROXY ? null : miles(c.home_city, loc ?? undefined),
      location_hidden_by_proxy: loc === PROXY,
      device: d ? { label: d.label, first_seen: day(d.first_seen), first_seen_today: day(d.first_seen) === alertDay } : null,
      memo: t.memo ?? null,
      times_customer_average_purchase: avg ? Math.round((t.amount / avg) * 10) / 10 : null,
    };
  });
  return {
    alert_id: a.id,
    rule_triggered: a.rule_triggered,
    alert_time: fmt(a.created_at),
    what_happened: a.what_happened,
    customer: { name: c.name, home_city: c.home_city, customer_since: c.customer_since, account_type: c.account_type },
    customer_average_purchase_90d: money(avg),
    triggering_activity: items,
    approved_total: money(items.filter((x) => x.status === 'approved').reduce((s, x) => s + x.amount, 0)),
    declined_count: items.filter((x) => x.status === 'declined').length,
  };
}

function transactionHistory(a: Alert) {
  const hist = history(a);
  const purchases = hist.filter(isPurchase);
  const avg = purchases.length ? purchases.reduce((s, t) => s + t.amount, 0) / purchases.length : 0;
  const cat = new Map<string, number>();
  for (const t of purchases) {
    const k = t.merchant_id ? merchantById.get(t.merchant_id)?.category ?? 'other' : 'other';
    cat.set(k, (cat.get(k) ?? 0) + 1);
  }
  const cityCount = new Map<string, { count: number; last: string }>();
  for (const t of hist) if (t.city) {
    const e = cityCount.get(t.city) ?? { count: 0, last: '' };
    e.count++; e.last = t.timestamp > e.last ? t.timestamp : e.last;
    cityCount.set(t.city, e);
  }
  const travel = hist.filter((t) => ['airline', 'hotel'].includes(merchantById.get(t.merchant_id ?? '')?.category ?? ''));
  const trig = triggerTxs(a);
  const comparison = trig.map((t) => {
    const sameMerchant = t.merchant_id ? hist.filter((h) => h.merchant_id === t.merchant_id) : [];
    const sameLoc = hist.filter((h) => location(h) === location(t));
    return {
      trigger: `${fmt(t.timestamp)} ${merchantName(t)} $${t.amount}`,
      purchases_at_this_merchant_before: sameMerchant.length,
      last_purchase_at_this_merchant: sameMerchant.length ? day(sameMerchant[sameMerchant.length - 1].timestamp) : null,
      earlier_activity_in_this_location: sameLoc.length,
    };
  });
  return {
    window: '90 days before the alert (triggering activity excluded)',
    purchase_count: purchases.length,
    average_purchase: money(avg),
    largest_purchase: money(Math.max(0, ...purchases.map((t) => t.amount))),
    top_categories: [...cat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([category, count]) => ({ category, count })),
    in_person_locations: [...cityCount.entries()].sort((x, y) => y[1].count - x[1].count).slice(0, 8).map(([city, v]) => ({ city, count: v.count, last_seen: day(v.last) })),
    travel_bookings: travel.map((t) => ({ date: day(t.timestamp), merchant: merchantName(t), amount: t.amount, memo: t.memo ?? null })),
    recent_activity: hist.slice(-12).map((t) => ({ time: fmt(t.timestamp), amount: t.amount, merchant: merchantName(t), channel: t.channel, location: location(t), status: t.status, memo: t.memo ?? null })),
    trigger_comparison: comparison,
  };
}

function devicesAndSignins(a: Alert) {
  const alertDay = day(a.created_at);
  const devs = (devicesByCustomer.get(a.customer_id) ?? []).filter((d) => d.first_seen <= a.created_at);
  const logins = (eventsByCustomer.get(a.customer_id) ?? []).filter((e) => e.type === 'login' && e.timestamp <= a.created_at);
  const lastUse = (id: string, stored: string) => {
    const uses = [
      ...(txByCustomer.get(a.customer_id) ?? []).filter((t) => t.device_id === id && t.timestamp <= a.created_at).map((t) => t.timestamp),
      ...(eventsByCustomer.get(a.customer_id) ?? []).filter((e) => e.device_id === id && e.timestamp <= a.created_at).map((e) => e.timestamp),
      stored > a.created_at ? '' : stored,
    ].sort();
    return uses[uses.length - 1] || a.created_at;
  };
  return {
    devices: devs.map((d) => ({
      label: d.label,
      first_seen: day(d.first_seen),
      last_seen: day(lastUse(d.id, d.last_seen)),
      first_seen_today: day(d.first_seen) === alertDay,
    })),
    recent_sign_ins: logins.slice(-8).map((e) => ({ time: fmt(e.timestamp), device: e.device_id ? deviceById.get(e.device_id)?.label ?? 'unknown' : 'unknown', device_first_seen_today: e.device_id ? day(deviceById.get(e.device_id)?.first_seen ?? '') === alertDay : null, location: e.ip_city, details: e.details ?? null })),
  };
}

const EVENT_LABEL: Record<string, string> = {
  password_reset: 'Password reset', email_changed: 'Email changed', phone_changed: 'Phone number changed',
  payee_added: 'New payee added', authorized_user_added: 'Authorized user added', mailing_address_changed: 'Mailing address changed',
  branch_verified_call: 'Customer called; identity verified by bank staff',
};

function accountChanges(a: Alert) {
  const since = new Date(new Date(a.created_at).getTime() - 30 * 864e5).toISOString().slice(0, 19);
  const evs = (eventsByCustomer.get(a.customer_id) ?? []).filter(
    (e) => e.type !== 'login' && e.timestamp <= a.created_at && (e.timestamp >= since || e.type === 'authorized_user_added'),
  );
  return {
    window: 'last 30 days (authorized users: any time)',
    changes: evs.map((e) => ({ time: fmt(e.timestamp), change: EVENT_LABEL[e.type] ?? e.type, device: e.device_id ? deviceById.get(e.device_id)?.label ?? 'unknown' : 'none (by phone)', device_first_seen_today: e.device_id ? day(deviceById.get(e.device_id)?.first_seen ?? '') === day(a.created_at) : null, location: e.ip_city, details: e.details ?? null })),
    none_found: evs.length === 0,
  };
}

function priorAlertsTool(a: Alert) {
  const ps = (priorByCustomer.get(a.customer_id) ?? []).filter((p) => p.date < a.created_at);
  return { prior_alerts: ps.map((p) => ({ date: day(p.date), rule: p.rule, outcome: p.outcome })), none_found: ps.length === 0 };
}

function merchantProfile(a: Alert) {
  const hist = history(a);
  const ids = [...new Set(triggerTxs(a).map((t) => t.merchant_id).filter(Boolean))] as string[];
  return {
    merchants: ids.map((id) => {
      const m = merchantById.get(id)!;
      const past = hist.filter((t) => t.merchant_id === id);
      return { name: m.name, category: m.category, online_only: m.online, fraud_reports_last_90_days_across_bank: m.fraud_reports_90d, this_customer_purchases_here_90d: past.length, last_purchase: past.length ? day(past[past.length - 1].timestamp) : null };
    }),
    not_applicable: ids.length === 0,
  };
}

function payeeDetails(a: Alert) {
  const trig = triggerTxs(a).filter((t) => t.payee_id);
  const all = (payeesByCustomer.get(a.customer_id) ?? []).filter((p) => p.added_at <= a.created_at);
  const hist = (txByCustomer.get(a.customer_id) ?? []).filter((t) => t.channel === 'transfer' && t.timestamp < a.created_at && !a.trigger.ids.includes(t.id));
  return {
    transfer_payees: trig.map((t) => {
      const p = payeeById.get(t.payee_id!)!;
      const prev = hist.filter((h) => h.payee_id === p.id);
      return { name: p.name, added: fmt(p.added_at), minutes_between_adding_and_sending: Math.round((new Date(t.timestamp).getTime() - new Date(p.added_at).getTime()) / 60000), previous_transfers_to_this_payee: prev.length };
    }),
    other_payees: all.filter((p) => !trig.some((t) => t.payee_id === p.id)).map((p) => ({ name: p.name, added: day(p.added_at), transfers_last_90d: hist.filter((h) => h.payee_id === p.id).length, typical_amount: hist.filter((h) => h.payee_id === p.id)[0]?.amount ?? null })),
    not_applicable: trig.length === 0,
  };
}

export const TOOLS: Record<ToolName, { title: string; description: string; run: (a: Alert) => unknown }> = {
  transaction_history: { title: 'Transaction history', description: "The customer's last 90 days of activity: average and largest purchase, usual categories and places, travel bookings, recent activity, and whether they've used this merchant or location before.", run: transactionHistory },
  devices_and_signins: { title: 'Devices and sign-ins', description: 'Devices the customer has used (first and last seen) and recent online banking sign-ins with location and two-factor details.', run: devicesAndSignins },
  account_changes: { title: 'Account changes', description: 'Password resets, contact detail changes, new payees, mailing address changes and authorized users in the last 30 days.', run: accountChanges },
  prior_alerts: { title: 'Past alerts', description: 'Earlier fraud alerts on this account and how each was resolved.', run: priorAlertsTool },
  merchant_profile: { title: 'Merchant check', description: 'The merchant in this alert: category, fraud reports across the bank in the last 90 days, and whether this customer has bought there before.', run: merchantProfile },
  payee_details: { title: 'Payee check', description: 'For transfers: who the payee is, when they were added, minutes between adding and sending, and earlier transfers to them.', run: payeeDetails },
};

export const TOOL_NAMES = Object.keys(TOOLS) as ToolName[];

export function runTool(name: ToolName, alertId: string) {
  return TOOLS[name].run(getAlert(alertId));
}

/** Checks the code always runs, regardless of what a model decides. */
export function requiredTools(alertId: string): ToolName[] {
  const a = getAlert(alertId);
  const req: ToolName[] = ['transaction_history'];
  if (triggerTxs(a).some((t) => t.channel === 'transfer')) req.push('payee_details', 'account_changes');
  return req;
}
