import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { formatNumber } from '@/lib/format';
import { clamp, invLerp } from '@/lib/math';
import { cx, FOCUS_RING } from './classes';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  marks?: readonly number[];
  /** Faixa [início, fim] em que o valor é destacado em âmbar. */
  warnRange?: readonly [number, number];
  disabled?: boolean;
}

function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** Encaixa `raw` na grade de passos a partir de `min`, dentro de [min, max]. */
export function snapToStep(raw: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((raw - min) / step) * step;
  return clamp(Number(snapped.toFixed(decimalsOf(step) + 2)), min, max);
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  format,
  onChange,
  marks,
  warnRange,
  disabled = false,
}: SliderProps) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pct = (x: number) => `${clamp(invLerp(min, max, x), 0, 1) * 100}%`;
  const inWarn = warnRange !== undefined && value >= warnRange[0] && value <= warnRange[1];
  const text = `${format ? format(value) : formatNumber(value, decimalsOf(step))}${unit ? ` ${unit}` : ''}`;

  const commit = (raw: number) => {
    const next = snapToStep(raw, min, max, step);
    if (next !== value) onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const big = step * 10;
    const deltas: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -big,
      PageUp: big,
    };
    const delta = deltas[e.key];
    if (delta !== undefined) commit(value + delta);
    else if (e.key === 'Home') commit(min);
    else if (e.key === 'End') commit(max);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const valueFromPointer = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return value;
    return min + clamp((clientX - rect.left) / rect.width, 0, 1) * (max - min);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    commit(valueFromPointer(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) commit(valueFromPointer(e.clientX));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div className={cx('flex flex-col gap-1.5', disabled && 'opacity-40')}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span id={labelId} className="text-slate-300">
          {label}
        </span>
        <span
          className={cx('font-mono tabular-nums', inWarn ? 'text-amber-400' : 'text-cyan-300')}
          data-testid="slider-value"
        >
          {text}
        </span>
      </div>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        data-focusable
        data-slider
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cx(
          'relative flex h-8 cursor-pointer touch-none items-center rounded-md',
          FOCUS_RING,
        )}
      >
        <div ref={trackRef} className="relative h-1.5 w-full rounded-full bg-slate-800">
          {warnRange && (
            <div
              aria-hidden
              className="absolute inset-y-0 rounded-full bg-amber-400/40"
              style={{
                left: pct(warnRange[0]),
                width: `${(clamp(invLerp(min, max, warnRange[1]), 0, 1) - clamp(invLerp(min, max, warnRange[0]), 0, 1)) * 100}%`,
              }}
            />
          )}
          <div
            aria-hidden
            className={cx(
              'absolute inset-y-0 left-0 rounded-full',
              inWarn ? 'bg-amber-400' : 'bg-cyan-400',
            )}
            style={{ width: pct(value) }}
          />
          {marks?.map((m) => (
            <span
              key={m}
              aria-hidden
              className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-slate-400"
              style={{ left: pct(m) }}
            />
          ))}
          <span
            aria-hidden
            className={cx(
              'absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950',
              inWarn ? 'bg-amber-400' : 'bg-cyan-400',
            )}
            style={{ left: pct(value) }}
          />
        </div>
      </div>
    </div>
  );
}
