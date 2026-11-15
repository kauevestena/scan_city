import { LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import type { ButtonAction } from '@/input/actions';
import { InputGlyph } from '@/input/InputGlyph';
import { cx, FOCUS_RING } from './classes';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rift';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Ação de input cujo glyph acompanha o rótulo. */
  glyph?: ButtonAction;
  loading?: boolean;
  children?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)] border border-cyan-400',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700',
  ghost:
    'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100 border border-transparent',
  danger: 'bg-rose-500 text-slate-950 hover:bg-rose-400 border border-rose-500',
  rift: 'bg-violet-500 text-slate-50 hover:bg-violet-400 border border-violet-500',
};

const SIZE: Record<ButtonSize, { box: string; icon: number }> = {
  sm: { box: 'h-8 min-w-8 px-2.5 text-xs gap-1.5', icon: 16 },
  md: { box: 'h-10 min-w-10 px-4 text-sm gap-2', icon: 16 },
  lg: { box: 'h-12 min-w-12 px-6 text-base gap-2.5', icon: 20 },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  glyph,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const s = SIZE[size];
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      data-focusable
      data-glyph={glyph}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        FOCUS_RING,
        VARIANT[variant],
        s.box,
        className,
      )}
      onClick={(e) => {
        AudioEngine.get().play('UI_CLICK');
        onClick?.(e);
      }}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={s.icon} strokeWidth={1.75} className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={s.icon} strokeWidth={1.75} aria-hidden />
      )}
      {children}
      {glyph && (
        // Dica visual; o nome acessível do botão é só o rótulo.
        <span aria-hidden className="ml-1 inline-flex">
          <InputGlyph action={glyph} />
        </span>
      )}
    </button>
  );
}
