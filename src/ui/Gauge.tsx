import { formatPct } from '@/lib/format';
import { clamp } from '@/lib/math';
import { cx, TONE_BG, TONE_TEXT, type StatusTone } from './classes';

export interface GaugeThresholds {
  warn: number;
  danger: number;
}

export interface GaugeProps {
  /** 0..1 */
  value: number;
  label: string;
  /**
   * Limiares de cor. Se `danger < warn`, valores baixos são ruins (bateria, cobertura);
   * se `danger > warn`, valores altos são ruins (erro, risco).
   */
  thresholds?: GaugeThresholds;
  variant?: 'bar' | 'arc';
  /** Texto do valor; por padrão, a porcentagem. */
  valueText?: string;
}

export function gaugeTone(value: number, thresholds?: GaugeThresholds): StatusTone {
  if (!thresholds) return 'neutral';
  const { warn, danger } = thresholds;
  if (danger < warn) return value <= danger ? 'danger' : value <= warn ? 'warn' : 'ok';
  return value >= danger ? 'danger' : value >= warn ? 'warn' : 'ok';
}

const ARC_RADIUS = 40;
const ARC_LENGTH = Math.PI * ARC_RADIUS;

export function Gauge({ value, label, thresholds, variant = 'bar', valueText }: GaugeProps) {
  const v = clamp(value, 0, 1);
  const tone = gaugeTone(v, thresholds);
  const text = valueText ?? formatPct(v);
  const aria = {
    role: 'meter',
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': 1,
    'aria-valuenow': v,
    'aria-valuetext': text,
  } as const;

  if (variant === 'arc') {
    return (
      <div {...aria} data-tone={tone} className="flex w-24 flex-col items-center">
        <svg viewBox="0 0 100 56" className={cx('w-full', TONE_TEXT[tone])} aria-hidden>
          <path
            d="M10 50 A40 40 0 0 1 90 50"
            fill="none"
            className="stroke-slate-800"
            strokeWidth={8}
            strokeLinecap="round"
          />
          <path
            d="M10 50 A40 40 0 0 1 90 50"
            fill="none"
            stroke="currentColor"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${ARC_LENGTH * v} ${ARC_LENGTH}`}
          />
        </svg>
        <span className={cx('-mt-4 font-mono text-sm tabular-nums', TONE_TEXT[tone])}>{text}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
    );
  }

  return (
    <div {...aria} data-tone={tone} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={cx('font-mono tabular-nums', TONE_TEXT[tone])}>{text}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={cx('h-full rounded-full transition-[width]', TONE_BG[tone])}
          style={{ width: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}
