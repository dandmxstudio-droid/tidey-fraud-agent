import './globals.css';
import type { Metadata } from 'next';
import { Nav } from './nav';
import { mockMode } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Tidey · Fraud alert agent · Tidewell (fictional bank)',
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
              <span className="logo">T</span>
              Tidey <small>Fraud alert agent · Tidewell (fictional bank)</small>
            </a>
            <Nav />
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
          <div className="wrap">All customers, transactions and alerts are synthetic. Tidewell is fictional. Built by Dan Mota.</div>
        </footer>
      </body>
    </html>
  );
}
