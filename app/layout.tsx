import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DemoNav, DemoNavFallback, Nav, NavFallback } from './nav';
import { mockMode } from '@/lib/config';
import { TidewellMark, TideyBadge } from './brand';

export const metadata: Metadata = {
  title: 'Tidey, fraud alert agent for Tidewell (fictional bank)',
  description: 'Tidey, a fraud alert investigation agent built two ways: Jev decisions with code rules, vs one AI model doing everything. Synthetic data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mock = mockMode();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap">
            <a className="brand" href="/">
              <span className="product"><TideyBadge size={30} live />Tidey <small>Fraud alert agent</small></span>
            </a>
            <Suspense fallback={<NavFallback />}><Nav /></Suspense>
          </div>
        </header>
        {mock && (
          <div className="banner">
            <div className="wrap">Mock mode: no API keys found, so answers come from simple stand-in rules, not Jev or OpenAI. Numbers here are not real results.</div>
          </div>
        )}
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer>
          <div className="wrap foot">
            <div className="foot-brand">
              <span className="bank"><TidewellMark size={22} />Tidewell</span>
              <p>Tidey is Tidewell’s fraud alert agent. Tidewell is a fictional bank, and every customer, transaction and alert here is synthetic. Designed and built by Dan Mota.</p>
            </div>
            <div className="foot-demo">
              <span>Behind the demo</span>
              <Suspense fallback={<DemoNavFallback />}><DemoNav /></Suspense>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
