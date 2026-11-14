import type { LucideIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { cx, FOCUS_RING } from './classes';
import { Tooltip } from './Tooltip';

export interface TabDef<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Motivo exibido quando a aba está desabilitada. */
  reason?: string;
}

export interface TabsProps<T extends string = string> {
  tabs: ReadonlyArray<TabDef<T>>;
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}

/** Próxima aba habilitada a partir de `value`, no sentido `dir`, com volta. */
export function nextEnabledTab<T extends string>(
  tabs: ReadonlyArray<TabDef<T>>,
  value: T,
  dir: 1 | -1,
): T {
  const start = tabs.findIndex((t) => t.id === value);
  for (let k = 1; k <= tabs.length; k++) {
    const tab = tabs[(start + dir * k + tabs.length * k) % tabs.length];
    if (tab && !tab.disabled) return tab.id;
  }
  return value;
}

export function Tabs<T extends string = string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: TabsProps<T>) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = nextEnabledTab(tabs, value, e.key === 'ArrowRight' ? 1 : -1);
    if (next !== value) onChange(next);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="flex gap-1 border-b border-slate-700"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        const Icon = tab.icon;
        const button = (
          <button
            type="button"
            role="tab"
            data-focusable
            aria-selected={selected}
            aria-disabled={tab.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              if (!tab.disabled && !selected) onChange(tab.id);
            }}
            className={cx(
              '-mb-px flex h-10 items-center gap-2 rounded-t-md border-b-2 px-4 text-sm font-medium transition-colors',
              FOCUS_RING,
              selected
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-100',
              tab.disabled && 'cursor-not-allowed opacity-40 hover:text-slate-400',
            )}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
            {tab.label}
          </button>
        );
        return tab.disabled && tab.reason ? (
          <Tooltip key={tab.id} content={tab.reason}>
            {button}
          </Tooltip>
        ) : (
          <span key={tab.id} className="inline-flex">
            {button}
          </span>
        );
      })}
    </div>
  );
}
