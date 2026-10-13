import alertsJson from '@/data/alerts.json';
import customersJson from '@/data/customers.json';
import transactionsJson from '@/data/transactions.json';
import devicesJson from '@/data/devices.json';
import eventsJson from '@/data/security_events.json';
import payeesJson from '@/data/payees.json';
import priorJson from '@/data/prior_alerts.json';
import merchantsJson from '@/data/merchants.json';
import citiesJson from '@/data/cities.json';
import type { Alert, City, Customer, Device, Merchant, Payee, PriorAlert, SecurityEvent, Transaction } from './types';

// Synthetic data for a fictional bank. Loaded once per server instance.
export const alerts = alertsJson as Alert[];
export const customers = customersJson as Customer[];
export const transactions = transactionsJson as Transaction[];
export const devices = devicesJson as Device[];
export const events = eventsJson as SecurityEvent[];
export const payees = payeesJson as Payee[];
export const priorAlerts = priorJson as PriorAlert[];
export const merchants = merchantsJson as Merchant[];
export const cities = citiesJson as City[];

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
export const alertById = byId(alerts);
export const customerById = byId(customers);
export const txById = byId(transactions);
export const deviceById = byId(devices);
export const payeeById = byId(payees);
export const merchantById = byId(merchants);
export const cityByName = new Map(cities.map((c) => [c.name, c]));

const group = <T extends { customer_id: string }>(xs: T[]) => {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const arr = m.get(x.customer_id) ?? [];
    arr.push(x);
    m.set(x.customer_id, arr);
  }
  return m;
};
export const txByCustomer = group(transactions);
export const devicesByCustomer = group(devices);
export const eventsByCustomer = group(events);
export const payeesByCustomer = group(payees);
export const priorByCustomer = group(priorAlerts);

/** Public list for the UI: alert basics only (no answers). */
export function alertList() {
  return alerts.map((a) => ({ id: a.id, what_happened: a.what_happened, amount: a.amount, rule_triggered: a.rule_triggered, created_at: a.created_at }));
}
