'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Queue' },
  { href: '/proof', label: 'Test results' },
  { href: '/how', label: 'How it works' },
];

function Links({ section }: { section: string }) {
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={section === l.href ? 'on' : ''} aria-current={section === l.href ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

const sectionOf = (p: string, from?: string | null) =>
  p.startsWith('/proof') || (p.startsWith('/cases') && from === 'proof') ? '/proof' : p.startsWith('/how') ? '/how' : '/';

// A case opened from the test results belongs to that section, so the nav reads the ?from= param.
export function Nav() {
  const p = usePathname();
  const from = useSearchParams().get('from');
  return <Links section={sectionOf(p, from)} />;
}

// Rendered while search params load, so the nav never flashes empty.
export function NavFallback() {
  return <Links section={sectionOf(usePathname())} />;
}
