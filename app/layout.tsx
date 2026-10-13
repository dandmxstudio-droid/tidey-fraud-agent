import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './globals.css';
import type { Metadata } from 'next';
import { Nav } from './nav';
import { mockMode } from '@/lib/config';
import { TidewellMark, TideyBadge } from './brand';

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
              <span className="bank"><TidewellMark size={24} />Tidewell</span>
              <span className="divider" />
              <span className="product"><TideyBadge />Tidey <small>Fraud alert agent</small></span>
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
          <div className="wrap">Tidewell is a fictional bank and every customer, transaction and alert here is synthetic. Tidey and this demo were built by Dan Mota.</div>
        </footer>
      </body>
    </html>
  );
}
