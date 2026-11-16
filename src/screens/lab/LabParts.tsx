import type { ReactNode } from 'react';
import { STRINGS } from '@/data/strings';
import { cx } from '@/ui';

const L = STRINGS.lab;

/** Seção da coluna lateral, com um título discreto. */
export function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} data-testid={testId} className="flex flex-col gap-3">
      <h3 className="text-xs tracking-widest text-slate-400 uppercase">{title}</h3>
      {children}
    </section>
  );
}

export type ReadingTone = 'ok' | 'warn' | 'danger' | 'neutral';

const TONE: Record<ReadingTone, string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  danger: 'text-rose-400',
  neutral: 'text-slate-100',
};

/** Uma leitura (rótulo e valor em `font-mono`), com um `data-testid` para os testes. */
export function Reading({
  label,
  value,
  testId,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  testId: string;
  tone?: ReadingTone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-slate-400">{label}</dt>
      <dd className={cx('font-mono', TONE[tone])} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

/** Fórmulas ao vivo: uma por linha, em `font-mono`, com os valores já substituídos. */
export function Formulas({ lines }: { lines: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 font-mono text-xs leading-relaxed text-cyan-300">
      {lines.map((line, k) => (
        <li key={k} data-testid={`formula-${k}`}>
          {line}
        </li>
      ))}
    </ul>
  );
}

/** "Você sabia?": um texto curto. */
export function Tip({ children }: { children: ReactNode }) {
  return (
    <aside
      data-testid="lab-tip"
      className="rounded-md border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300"
    >
      <p className="mb-1 text-xs font-medium tracking-widest text-amber-400 uppercase">
        {L.tipTitle}
      </p>
      {children}
    </aside>
  );
}
