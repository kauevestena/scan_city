import { formatPct } from '@/lib/format';
import { clamp } from '@/lib/math';
import { cx } from './classes';

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  label?: string;
  striped?: boolean;
  animated?: boolean;
}

export function ProgressBar({ value, label, striped = false, animated = false }: ProgressBarProps) {
  const v = clamp(value, 0, 1);
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-slate-400">{label}</span>
          <span className="font-mono text-cyan-300 tabular-nums">{formatPct(v)}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={v}
        className="h-2.5 overflow-hidden rounded-full bg-slate-800"
      >
        <div
          data-testid="progress-fill"
          className={cx(
            'h-full rounded-full bg-cyan-400 transition-[width]',
            striped &&
              'bg-[linear-gradient(135deg,rgba(2,6,23,0.3)_25%,transparent_25%,transparent_50%,rgba(2,6,23,0.3)_50%,rgba(2,6,23,0.3)_75%,transparent_75%)] bg-[length:32px_32px]',
            striped && animated && 'animate-stripes',
          )}
          style={{ width: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}
