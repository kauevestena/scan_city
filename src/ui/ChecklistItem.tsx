import { Circle, CircleCheck, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import type { Severity } from '@/types';
import { cx } from './classes';

export type ChecklistStatus = 'pass' | 'warn' | 'fail' | 'pending';

export interface ChecklistItemProps {
  status: ChecklistStatus;
  label: string;
  severity?: Severity;
  detail?: string;
}

const STATUS: Record<ChecklistStatus, { Icon: LucideIcon; color: string }> = {
  pass: { Icon: CircleCheck, color: 'text-emerald-400' },
  warn: { Icon: TriangleAlert, color: 'text-amber-400' },
  fail: { Icon: CircleX, color: 'text-rose-500' },
  pending: { Icon: Circle, color: 'text-slate-400' },
};

const SEVERITY_STYLE: Record<Severity, string> = {
  CRITICAL: 'border-rose-500/60 text-rose-400',
  MAJOR: 'border-amber-400/60 text-amber-400',
  MINOR: 'border-slate-700 text-slate-400',
};

export function ChecklistItem({ status, label, severity, detail }: ChecklistItemProps) {
  const { Icon, color } = STATUS[status];
  return (
    <li className="flex items-start gap-2.5 py-1.5" data-status={status}>
      <Icon size={20} strokeWidth={1.75} className={cx('mt-0.5 shrink-0', color)} aria-hidden />
      <span className="sr-only">{STRINGS.checklist.status[status]}:</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-100">{label}</p>
        {detail && <p className="font-mono text-xs text-slate-400 tabular-nums">{detail}</p>}
      </div>
      {severity && (
        <span
          className={cx(
            'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
            SEVERITY_STYLE[severity],
          )}
        >
          {STRINGS.checklist.severity[severity]}
        </span>
      )}
    </li>
  );
}
