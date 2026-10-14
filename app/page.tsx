import { config, mockMode } from '@/lib/config';
import { alertList } from '@/lib/data';
import { QueueClient } from './queue-client';

export const dynamic = 'force-dynamic';

export default function Page() {
  const settings = {
    closeAt: config.closeAt, unexplainedMax: config.unexplainedMax, escalateAt: config.escalateAt, scamRiskAt: config.scamRiskAt,
    maxAutoCloseAmount: config.maxAutoCloseAmount, checkAt: config.checkAt, jevModel: config.jevModel, openaiModel: config.openaiModel,
  };
  return <QueueClient alerts={alertList()} mock={mockMode()} featured={config.featuredAlerts} settings={settings} />;
}
