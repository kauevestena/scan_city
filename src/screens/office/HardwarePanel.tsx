import { ShoppingCart } from 'lucide-react';
import { HARDWARE, HARDWARE_ORDER } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { formatBRL, formatNumber } from '@/lib/format';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { Button, cx, MoneyText } from '@/ui';
import { priceOf } from './shopModel';

const W = STRINGS.office.workstation;

/** Aba Hardware da Workstation (office §5): o atual e o próximo da sequência; os demais ficam à vista. */
export function HardwarePanel() {
  const current = useGameStore((s) => s.inventory.hardware);
  const shopPriceMod = useGameStore((s) => selectModifiers(s).shopPrice);
  const at = HARDWARE_ORDER.indexOf(current);
  const nextId = HARDWARE_ORDER[at + 1];

  return (
    <div className="mt-3 flex flex-col gap-2" data-testid="hardware-panel">
      <p className="text-xs text-slate-400">{W.sequenceHint}</p>
      <ul className="flex flex-col gap-2">
        {HARDWARE.map((hw, i) => {
          const state =
            i < at ? 'REPLACED' : i === at ? 'CURRENT' : hw.id === nextId ? 'NEXT' : 'LOCKED';
          const price = priceOf(
            { id: hw.id, kind: 'HARDWARE', name: hw.name, priceBRL: hw.priceBRL },
            shopPriceMod,
          );
          return (
            <li
              key={hw.id}
              data-testid={`hardware-${hw.id}`}
              data-state={state}
              className={cx(
                'flex flex-col gap-1.5 rounded-md border bg-slate-800 p-3',
                state === 'CURRENT' ? 'border-cyan-400/60' : 'border-slate-700',
                (state === 'REPLACED' || state === 'LOCKED') && 'opacity-60',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-slate-100">{hw.name}</span>
                <span className="text-xs text-slate-400">
                  {state === 'CURRENT' && W.current}
                  {state === 'REPLACED' && W.replaced}
                  {state === 'NEXT' && W.next}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-200">
                {W.hardwareSpeed(formatNumber(hw.speedFactor, 1))}
              </p>
              <p className="text-xs text-slate-400">{hw.description}</p>
              {state === 'NEXT' && (
                <>
                  <MoneyText cents={price} className="text-base" />
                  <Button
                    size="sm"
                    variant="primary"
                    icon={ShoppingCart}
                    data-focus-id="buy-hardware"
                    onClick={() => useGameStore.getState().buyItem(hw.id)}
                  >
                    {W.buy(formatBRL(price))}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
