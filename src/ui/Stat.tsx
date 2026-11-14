import type { ReactNode } from 'react';
import { cx, TONE_TEXT, type StatusTone } from './classes';

export interface StatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  status?: StatusTone;
  hint?: string;
}

/** Leitura técnica (HUD e painéis): rótulo discreto e valor monoespaçado. */
export function Stat({ label, value, unit, status = 'neutral', hint }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5" data-status={status}>
      <span className="text-xs text-slate-400">{label}</span>
      <span className={cx('font-mono text-sm tabular-nums', TONE_TEXT[status])}>
        {value}
        {unit && <span className="ml-1 text-xs text-slate-400">{unit}</span>}
      </span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  );
}
