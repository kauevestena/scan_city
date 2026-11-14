import {
  BadgeCheck,
  Coins,
  Info,
  OctagonAlert,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { STRINGS } from '@/data/strings';
import { cx, FOCUS_RING } from './classes';

export type ToastType = 'info' | 'success' | 'warn' | 'error' | 'money' | 'rift';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  body?: string;
  icon?: LucideIcon;
}

export interface ToastProps extends Omit<ToastData, 'id'> {
  onDismiss?: () => void;
}

const STYLE: Record<ToastType, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: 'border-cyan-400/60', icon: 'text-cyan-400', Icon: Info },
  success: { box: 'border-emerald-400/60', icon: 'text-emerald-400', Icon: BadgeCheck },
  warn: { box: 'border-amber-400/60', icon: 'text-amber-400', Icon: TriangleAlert },
  error: { box: 'border-rose-500/60', icon: 'text-rose-500', Icon: OctagonAlert },
  money: { box: 'border-lime-300/60', icon: 'text-lime-300', Icon: Coins },
  rift: { box: 'border-violet-500/60', icon: 'text-violet-400', Icon: Sparkles },
};

export function Toast({ type, title, body, icon, onDismiss }: ToastProps) {
  const style = STYLE[type];
  const Icon = icon ?? style.Icon;
  return (
    <div
      role={type === 'error' || type === 'warn' ? 'alert' : 'status'}
      data-toast-type={type}
      className={cx(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-lg border bg-slate-900/95 px-3 py-2.5 shadow-lg backdrop-blur-sm',
        style.box,
      )}
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        className={cx('mt-0.5 shrink-0', style.icon)}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        {body && <p className="mt-0.5 text-xs text-slate-300">{body}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label={STRINGS.ui.dismissToast}
          onClick={onDismiss}
          className={cx(
            '-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:text-slate-100',
            FOCUS_RING,
          )}
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  );
}
