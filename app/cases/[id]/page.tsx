import { notFound } from 'next/navigation';
import { config } from '@/lib/config';
import { alertById } from '@/lib/data';
import { CaseClient } from './case-client';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = alertById.get(id);
  if (!a) notFound();
  return <CaseClient alert={{ id: a.id, what_happened: a.what_happened, amount: a.amount, rule_triggered: a.rule_triggered }} featured={config.featuredAlerts.includes(a.id)} />;
}
