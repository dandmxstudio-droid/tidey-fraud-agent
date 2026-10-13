'use client';
import { usePathname } from 'next/navigation';

export function Nav() {
  const p = usePathname();
  const on = (x: string) => (x === '/' ? p === '/' || p.startsWith('/cases') : p.startsWith(x)) ? 'on' : '';
  return (
    <nav className="nav">
      <a className={on('/')} href="/">Results</a>
      <a className={on('/how')} href="/how">How it works</a>
    </nav>
  );
}
