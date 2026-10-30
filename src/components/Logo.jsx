import { useId } from 'react';

/** Marca do painel: barras subindo e o "fôlego" (curva) que leva ao topo. */
export function LogoMark({ className = 'h-10 w-10', animated = true }) {
  const id = useId().replace(/:/g, '');
  const a = animated ? 'anim-bar' : '';
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="48" x2="48" y2="0">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="48">
          <stop offset="0" stopColor="#1c1c20" />
          <stop offset="1" stopColor="#0b0b0d" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" fill={`url(#${id}b)`} stroke={`url(#${id}g)`} strokeOpacity="0.55" />
      <rect x="10" y="29" width="7" height="9" rx="2" fill={`url(#${id}g)`} opacity="0.5" className={a} style={{ animationDelay: '0.05s' }} />
      <rect x="20.5" y="23" width="7" height="15" rx="2" fill={`url(#${id}g)`} opacity="0.75" className={a} style={{ animationDelay: '0.15s' }} />
      <rect x="31" y="17" width="7" height="21" rx="2" fill={`url(#${id}g)`} className={a} style={{ animationDelay: '0.25s' }} />
      <path d="M9 23.5C17 22 23 15.5 35.5 10.5" stroke="#ecfdf5" strokeWidth="2.4" fill="none" strokeLinecap="round" className={animated ? 'anim-draw' : ''} />
      <circle cx="36.5" cy="10" r="2.8" fill="#ecfdf5" />
    </svg>
  );
}

/** Logo completo: marca + nome. */
export default function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark className={compact ? 'h-9 w-9' : 'h-12 w-12'} />
      {!compact && (
        <div className="leading-tight">
          <p className="bg-gradient-to-r from-emerald-300 via-emerald-200 to-cyan-300 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            Fôlego
          </p>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Finanças pessoais</p>
        </div>
      )}
    </div>
  );
}
