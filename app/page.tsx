import { mockMode } from '@/lib/config';
import { alertList } from '@/lib/data';
import { QueueClient } from './queue-client';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <QueueClient alerts={alertList()} mock={mockMode()} />;
}
