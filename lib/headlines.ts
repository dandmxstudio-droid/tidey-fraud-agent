// Plain-language one-liners for each check, so an analyst can scan findings without opening raw data.
import { money } from './labels';
import type { RunResult } from './types';

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function toolHeadline(name: string, d: Any | undefined): string {
  if (!d) return '';
  switch (name) {
    case 'transaction_history': {
      const parts = [`Usually spends ${money(d.average_purchase)} a purchase; largest in 90 days ${money(d.largest_purchase)}.`];
      const c = d.trigger_comparison?.[0];
      if (c) {
        parts.push(c.purchases_at_this_merchant_before > 0 ? `Has bought here ${plural(c.purchases_at_this_merchant_before, 'time')} before.` : 'Never bought here before.');
        if (c.earlier_activity_in_this_location === 0) parts.push('No earlier activity in this location.');
      }
      if (d.travel_bookings?.length) parts.push(`Travel booked: ${d.travel_bookings.map((t: Any) => t.memo ?? t.merchant).join('; ')}.`);
      return parts.join(' ');
    }
    case 'devices_and_signins': {
      const fresh = (d.recent_sign_ins ?? []).filter((s: Any) => s.device_first_seen_today);
      if (fresh.length) return `New device signed in today from ${fresh[0].location}${fresh[0].details ? `: ${fresh[0].details.toLowerCase()}` : ''}.`;
      const newDev = (d.devices ?? []).find((x: Any) => x.first_seen_today);
      if (newDev) return `${newDev.label} first seen today, with no online banking sign-in from it.`;
      return `${plural((d.devices ?? []).length, 'known device')}; recent sign-ins all from known devices.`;
    }
    case 'account_changes': {
      if (d.none_found) return 'No password, contact, payee or address changes in the last 30 days.';
      const ch = (d.changes ?? []) as Any[];
      const fromNew = ch.some((c) => c.device_first_seen_today);
      return `${ch.map((c) => c.change).join(', ')}${fromNew ? ', from a device first seen today' : ''}.`;
    }
    case 'prior_alerts':
      return d.none_found ? 'No past alerts on this account.' : `${plural(d.prior_alerts.length, 'past alert')}: ${d.prior_alerts.map((p: Any) => `${p.date.slice(0, 4)} ${p.outcome}`).join(', ')}.`;
    case 'merchant_profile': {
      const m = d.merchants?.[0];
      if (!m) return 'No merchant on this alert.';
      return `${m.name} (${m.category}): ${plural(m.fraud_reports_last_90_days_across_bank, 'fraud report')} across the bank in 90 days; ${m.this_customer_purchases_here_90d ? `customer bought here ${plural(m.this_customer_purchases_here_90d, 'time')}` : 'customer never bought here'}.`;
    }
    case 'payee_details': {
      const p = d.transfer_payees?.[0];
      if (!p) return 'No transfer on this alert.';
      return `${p.name} added ${plural(p.minutes_between_adding_and_sending, 'minute')} before the transfer; ${p.previous_transfers_to_this_payee ? plural(p.previous_transfers_to_this_payee, 'earlier transfer') : 'no earlier transfers'}.`;
    }
  }
  return '';
}

/** Why Tidey closed an alert, in one line, from the evidence it gathered. */
export function closedReason(r: RunResult): string {
  const ev: Record<string, Any> = {};
  for (const s of r.trace.steps) if (s.kind === 'tool') ev[s.label] = s.data as Any;
  const th = ev['Transaction history'], dv = ev['Devices and sign-ins'], ac = ev['Account changes'], pa = ev['Past alerts'];
  const ctx = r.trace.steps[0]?.data as Any;
  const t = ctx?.triggering_activity?.[ctx.triggering_activity.length - 1];
  if (th?.travel_bookings?.length && t?.distance_from_home_miles > 100) return `Matches a booked trip: ${th.travel_bookings[0].memo ?? 'travel booking'}`;
  if ((dv?.recent_sign_ins ?? []).some((s: Any) => s.device_first_seen_today && /passed/.test(s.details ?? ''))) return 'New phone passed a two-factor check from home';
  if ((ac?.changes ?? []).some((c: Any) => /Authorized user/.test(c.change))) return 'Made on an authorized user’s card';
  if ((ac?.changes ?? []).some((c: Any) => /verified/.test(c.change))) return 'Change verified with the customer by phone';
  if ((pa?.prior_alerts ?? []).some((p: Any) => p.outcome === 'legitimate' && /merchant not used/.test(p.rule))) return 'Same annual charge was confirmed last year';
  const c = th?.trigger_comparison?.[0];
  if (c?.purchases_at_this_merchant_before > 0) return `Has shopped here before; ${t?.channel === 'in_store' ? 'card present' : 'known device'}`;
  if (c?.earlier_activity_in_this_location > 0 && t?.distance_from_home_miles > 0) return `Visits ${t.location} regularly`;
  return 'Fits the customer’s normal spending';
}

export function firstSentence(s?: string) {
  if (!s) return '';
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}
