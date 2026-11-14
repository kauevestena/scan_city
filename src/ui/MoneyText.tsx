import { formatBRL } from '@/lib/format';
import { cx } from './classes';

export interface MoneyTextProps {
  cents: number;
  /** Prefixa "+" nos valores positivos. */
  signed?: boolean;
  className?: string;
}

export function MoneyText({ cents, signed = false, className }: MoneyTextProps) {
  const negative = cents < 0;
  return (
    <span
      data-negative={negative || undefined}
      className={cx(
        'font-mono tabular-nums',
        negative ? 'text-rose-500' : 'text-lime-300',
        className,
      )}
    >
      {signed && cents > 0 ? '+' : ''}
      {formatBRL(cents)}
    </span>
  );
}
