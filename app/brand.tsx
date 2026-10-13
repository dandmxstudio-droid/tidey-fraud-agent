// Tidewell (fictional bank) logo 1b "Tide t": a t whose crossbar is a wave. From the Tidewell brand sheet.
export function TidewellMark({ size = 24, wave = 'oklch(0.64 0.14 238)', stem = 'oklch(0.3 0.08 255)' }: { size?: number; wave?: string; stem?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M8 20 C16 12 24 12 32 20 C40 28 48 28 56 20" style={{ fill: 'none', stroke: wave, strokeWidth: 8, strokeLinecap: 'round' }} />
      <path d="M32 33 V45 A10 10 0 0 0 42 55 H46" style={{ fill: 'none', stroke: stem, strokeWidth: 8, strokeLinecap: 'round' }} />
    </svg>
  );
}

// Tidey: the agent's own small badge, the brand wave on navy. When live, the wave flows like a tide.
export function TideyBadge({ size = 26, live = false }: { size?: number; live?: boolean }) {
  const inner = size * 0.72;
  return (
    <span className={`tidey${live ? ' live' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={inner} height={inner} aria-hidden="true">
        {live ? (
          <g className="tide-flow">
            <path d="M-40 32 C-32 24 -24 24 -16 32 C-8 40 0 40 8 32 C16 24 24 24 32 32 C40 40 48 40 56 32 C64 24 72 24 80 32 C88 40 96 40 104 32" style={{ fill: 'none', stroke: 'oklch(0.76 0.12 228)', strokeWidth: 9, strokeLinecap: 'round' }} />
          </g>
        ) : (
          <path d="M8 32 C16 24 24 24 32 32 C40 40 48 40 56 32" style={{ fill: 'none', stroke: 'oklch(0.76 0.12 228)', strokeWidth: 9, strokeLinecap: 'round' }} />
        )}
      </svg>
    </span>
  );
}
