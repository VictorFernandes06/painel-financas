import { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, LayoutGrid, Landmark, Sheet, Target, X } from 'lucide-react';
import Logo from './Logo';

/** Páginas do menu. `tabs` aparecem como submenu e como abas no topo da página. */
export const PAGES = {
  visao: { label: 'Visão geral', icon: LayoutGrid, section: null },
  receitas: {
    label: 'Receitas', icon: ArrowUpCircle, tone: 'text-income', section: 'Movimentações',
    tabs: [['mes', 'Do mês'], ['proximas', 'Próximos meses'], ['todas', 'Todas'], ['categorias', 'Por categoria']],
  },
  despesas: {
    label: 'Despesas', icon: ArrowDownCircle, tone: 'text-expense', section: 'Movimentações',
    tabs: [['mes', 'Do mês'], ['apagar', 'A pagar'], ['pagas', 'Pagas'], ['todas', 'Todas'], ['grupos', 'Por grupo']],
  },
  contas: {
    label: 'Contas', icon: Landmark, tone: 'text-sky-400', section: 'Patrimônio',
    tabs: [['saldos', 'Saldos'], ['transferencias', 'Transferências']],
  },
  planejamento: { label: 'Planejamento', icon: Target, tone: 'text-amber-400', section: 'Planejamento' },
};

function NavItem({ id, page, active, tab, hint, badge, onNavigate }) {
  const Icon = page.icon;
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  const hasTabs = Boolean(page.tabs);
  return (
    <li>
      <div
        className={`group relative flex items-center rounded-lg transition-colors ${
          active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
        }`}
      >
        {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-emerald-400" aria-hidden />}
        <button
          type="button"
          onClick={() => onNavigate(id, page.tabs?.[0]?.[0])}
          aria-current={active ? 'page' : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
        >
          <Icon className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${active ? page.tone ?? 'text-zinc-100' : 'text-zinc-400'}`} aria-hidden />
          <span className="min-w-0">
            <span className={`block truncate text-sm font-medium ${active ? 'text-zinc-50' : 'text-zinc-300'}`}>{page.label}</span>
            {hint && <span className="block truncate text-[11px] text-zinc-500">{hint}</span>}
          </span>
        </button>
        {badge != null && badge !== 0 && (
          <span className="mr-1 rounded-full bg-white/[0.06] px-1.5 text-[11px] tabular-nums text-zinc-400">{badge}</span>
        )}
        {hasTabs && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${open ? 'Recolher' : 'Expandir'} ${page.label}`}
            className="mr-1 rounded-md p-1.5 text-zinc-500 hover:text-zinc-200"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        )}
      </div>
      {hasTabs && (
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <ul className="overflow-hidden">
            {page.tabs.map(([key, label]) => {
              const on = active && tab === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onNavigate(id, key)}
                    tabIndex={open ? 0 : -1}
                    className={`relative ml-5 flex w-[calc(100%-1.25rem)] items-center rounded-md border-l py-1.5 pl-4 pr-2 text-left text-[13px] transition-colors ${
                      on ? 'border-emerald-400 bg-white/[0.05] font-medium text-zinc-50' : 'border-white/10 text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

/** Menu lateral fixo no computador e gaveta no celular. */
export default function Sidebar({ pages = PAGES, route, onNavigate, open, onClose, hints = {}, badges = {}, spreadsheetTitle }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const sections = [];
  for (const [id, page] of Object.entries(pages)) {
    let sec = sections.find((s) => s.name === page.section);
    if (!sec) sections.push((sec = { name: page.section, items: [] }));
    sec.items.push([id, page]);
  }

  const go = (page, tab) => {
    onNavigate(page, tab);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r border-white/[0.06] bg-[#0c0c0f] transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-64 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu principal"
      >
        {/* fundo animado */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <span className="bokeh left-[-30px] top-[-20px] h-40 w-40 bg-emerald-500" />
          <span className="bokeh right-[-40px] top-40 h-36 w-36 bg-cyan-500" style={{ animationDelay: '-6s' }} />
          <span className="bokeh bottom-24 left-6 h-32 w-32 bg-emerald-700" style={{ animationDelay: '-12s' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0c0c0f]/60 to-[#0c0c0f]" />
        </div>

        <div className="relative flex items-center justify-between px-5 pb-5 pt-6">
          <Logo />
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-100 lg:hidden" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {sections.map((sec) => (
            <div key={sec.name ?? 'top'}>
              {sec.name && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{sec.name}</p>}
              <ul className="space-y-0.5">
                {sec.items.map(([id, page]) => (
                  <NavItem
                    key={id}
                    id={id}
                    page={page}
                    active={route.page === id}
                    tab={route.tab}
                    hint={hints[id]}
                    badge={badges[id]}
                    onNavigate={go}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/[0.06] px-5 py-4 text-[11px] leading-relaxed text-zinc-500">
          <p className="flex items-center gap-1.5 text-zinc-400">
            <Sheet className="h-3.5 w-3.5 text-income" aria-hidden />
            <span className="truncate">{spreadsheetTitle || 'Planilha do Google'}</span>
          </p>
          <p className="mt-1">Tudo é lido e gravado na sua planilha. O que você muda lá aparece aqui ao recarregar.</p>
        </div>
      </aside>
    </>
  );
}
