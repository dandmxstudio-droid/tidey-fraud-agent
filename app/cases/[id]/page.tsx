import { notFound } from 'next/navigation';
import { config } from '@/lib/config';
import { alertById } from '@/lib/data';
import { CaseClient } from './case-client';

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; view?: string; run?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const a = alertById.get(id);
  if (!a) notFound();
  return <CaseClient alert={{ id: a.id, what_happened: a.what_happened, amount: a.amount, rule_triggered: a.rule_triggered }} featured={config.featuredAlerts.includes(a.id)} from={sp.from === 'proof' ? 'proof' : 'queue'} view={sp.view} runKind={sp.run} />;
}
