import { Check, Lock, ShoppingCart } from 'lucide-react';
import { STRINGS } from '@/data/strings';
import type { ShopItem } from '@/domain/economy';
import { formatBRL } from '@/lib/format';
import { Button, cx, MoneyText } from '@/ui';
import { specRows, type CardState } from './shopModel';

const G = STRINGS.office.garage;

export interface ShopItemCardProps {
  item: ShopItem;
  state: CardState;
  /** Preço cobrado, já com o desconto `shopPrice`. */
  price: number;
  /** Aviso extra (combo T2: o que já se possui). */
  note?: string;
  /** Rótulo do botão de ação quando o item é possuído (ex.: "Equipar"). */
  ownedAction?: { label: string; onClick: () => void; active?: boolean };
  /** Amostras de cor (pintura): vêm dos dados do cosmético. */
  swatches?: readonly string[];
  onBuy: () => void;
}

/** Card de um item da loja: especificações, preço (com desconto) e estado. */
export function ShopItemCard({
  item,
  state,
  price,
  note,
  ownedAction,
  swatches,
  onBuy,
}: ShopItemCardProps) {
  const rows = specRows(item);
  const discounted = price !== item.priceBRL;
  return (
    <li
      className={cx(
        'flex flex-col gap-2 rounded-md border bg-slate-800 p-3',
        state.kind === 'OWNED' ? 'border-emerald-500/40' : 'border-slate-700',
        state.kind === 'LOCKED' && 'opacity-80',
      )}
      data-testid={`shop-item-${item.id}`}
      data-state={state.kind}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-100">{item.name}</span>
        {state.kind === 'OWNED' && (
          <span className="flex items-center gap-1 text-xs text-emerald-300">
            <Check size={14} aria-hidden />
            {G.owned}
          </span>
        )}
      </div>
      {swatches && (
        <span className="flex gap-1" aria-hidden>
          {swatches.map((c, k) => (
            <span
              key={k}
              className="size-4 rounded-sm border border-slate-600"
              style={{ backgroundColor: c }}
            />
          ))}
        </span>
      )}
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-400">{k}</dt>
              <dd className="text-right text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <p className="text-xs text-amber-300">{note}</p>}
      {state.kind !== 'OWNED' && (
        <div className="flex items-baseline gap-2" data-testid={`price-${item.id}`}>
          <MoneyText cents={price} className="text-base" />
          {discounted && (
            <span className="font-mono text-xs text-slate-500 line-through">
              {G.discount(formatBRL(item.priceBRL))}
            </span>
          )}
        </div>
      )}
      {state.kind === 'LOCKED' && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400" data-testid="locked-reason">
          <Lock size={14} aria-hidden />
          {state.reason}
        </p>
      )}
      {state.kind === 'BUY' && (
        <Button
          size="sm"
          variant="primary"
          icon={ShoppingCart}
          onClick={onBuy}
          data-focus-id={`buy-${item.id}`}
        >
          {G.buy}
        </Button>
      )}
      {state.kind === 'OWNED' && ownedAction && (
        <Button
          size="sm"
          variant={ownedAction.active ? 'ghost' : 'secondary'}
          disabled={ownedAction.active}
          onClick={ownedAction.onClick}
        >
          {ownedAction.label}
        </Button>
      )}
    </li>
  );
}
