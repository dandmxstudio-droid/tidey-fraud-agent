'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

// Two kinds of navigation: the app itself (the queue and its cases), and the pages about the demo
// (how Tidey was tested and how it works), which sit in a separate strip so they don't read as part of the workflow.
const sectionOf = (p: string, from?: string | null) =>
  p.startsWith('/proof') || (p.startsWith('/cases') && from === 'proof') ? '/proof' : p.startsWith('/how') ? '/how' : '/';

function AppLinks({ section }: { section: string }) {
  return (
    <nav className="nav" aria-label="App">
      <Link href="/" className={section === '/' ? 'on' : ''} aria-current={section === '/' ? 'page' : undefined}>Queue</Link>
    </nav>
  );
}

function DemoLinks({ section }: { section: string }) {
  const links = [
    { href: '/proof', label: 'Test Results' },
    { href: '/how', label: 'How It Works' },
  ];
  return (
    <nav className="demo-nav" aria-label="About this demo">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={section === l.href ? 'on' : ''} aria-current={section === l.href ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function Nav() {
  return <AppLinks section={sectionOf(usePathname(), useSearchParams().get('from'))} />;
}
export function NavFallback() {
  return <AppLinks section={sectionOf(usePathname())} />;
}
export function DemoNav() {
  return <DemoLinks section={sectionOf(usePathname(), useSearchParams().get('from'))} />;
}
export function DemoNavFallback() {
  return <DemoLinks section={sectionOf(usePathname())} />;
}
