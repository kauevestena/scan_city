import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './classes';

export type PanelVariant = 'default' | 'rift' | 'danger';

export interface PanelProps {
  title?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  variant?: PanelVariant;
  className?: string;
  children: ReactNode;
}

const VARIANT: Record<PanelVariant, { border: string; corner: string; title: string }> = {
  default: { border: 'border-slate-700', corner: 'border-cyan-400/60', title: 'text-cyan-400' },
  rift: {
    border: 'border-violet-500/60',
    corner: 'border-violet-500/80',
    title: 'text-violet-400',
  },
  danger: { border: 'border-rose-500/60', corner: 'border-rose-500/80', title: 'text-rose-400' },
};

const CORNERS = [
  'left-0 top-0 border-l-2 border-t-2 rounded-tl-lg',
  'right-0 top-0 border-r-2 border-t-2 rounded-tr-lg',
  'left-0 bottom-0 border-l-2 border-b-2 rounded-bl-lg',
  'right-0 bottom-0 border-r-2 border-b-2 rounded-br-lg',
];

/** Painel tático: borda, cantoneiras decorativas e cabeçalho opcional. */
export function Panel({
  title,
  icon: Icon,
  actions,
  variant = 'default',
  className,
  children,
}: PanelProps) {
  const v = VARIANT[variant];
  return (
    <section
      className={cx(
        'relative rounded-lg border bg-slate-900/90 backdrop-blur-sm',
        v.border,
        className,
      )}
      data-variant={variant}
    >
      {CORNERS.map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={cx('pointer-events-none absolute h-2 w-2', pos, v.corner)}
        />
      ))}
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
          <h2
            className={cx(
              'flex items-center gap-2 text-sm font-semibold tracking-widest uppercase',
              v.title,
            )}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
