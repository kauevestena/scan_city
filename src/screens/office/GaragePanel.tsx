import { Warehouse, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { COSMETICS } from '@/data/cosmetics';
import { itemName, type ShopItem } from '@/domain/economy';
import { STRINGS } from '@/data/strings';
import { unlockStateFrom } from '@/domain/progression';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { formatBRL } from '@/lib/format';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { Button, ConfirmDialog, Panel, Tabs, type TabDef } from '@/ui';
import { ShopItemCard } from './ShopItemCard';
import {
  GARAGE_TABS,
  cardState,
  comboOwned,
  itemsOfTab,
  priceOf,
  type GarageTab,
} from './shopModel';

const G = STRINGS.office.garage;
const TABS: ReadonlyArray<TabDef<GarageTab>> = GARAGE_TABS.map((id) => ({
  id,
  label: G.tabs[id],
}));

/** Garagem (office §5): a loja de equipamentos, em cinco abas, com confirmação da compra. */
export function GaragePanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<GarageTab>('AIRCRAFT');
  const [pending, setPending] = useState<ShopItem | null>(null);
  const player = useGameStore((s) => s.player);
  const contracts = useGameStore((s) => s.contracts);
  const inventory = useGameStore((s) => s.inventory);
  const shopPriceMod = useGameStore((s) => selectModifiers(s).shopPrice);
  const money = player.money;
  const unlock = unlockStateFrom({ contracts, player, inventory });
  useFocusNavigation(ref, { onBack: onClose, active: pending === null, autoFocus: true });

  const ctx = { money, inventory, unlock, shopPriceMod };
  const request = (item: ShopItem) => {
    const price = priceOf(item, shopPriceMod);
    // Sem saldo: nada de diálogo, o `buyItem` toca DENIED e mostra quanto falta.
    if (price > money) useGameStore.getState().buyItem(item.id);
    else setPending(item);
  };

  const missingForCombo = (item: ShopItem): string =>
    item.id === 'DRONE_T2'
      ? ['CAM_45MP_FF', 'LENS_35', 'GNSS_RTK_KIT']
          .filter((id) => !comboOwned(inventory).includes(id))
          .map(itemName)
          .join(', ')
      : '';

  return (
    <div
      ref={ref}
      className="absolute top-0 right-0 bottom-0 w-80 overflow-y-auto p-3 min-[1600px]:w-[380px]"
      data-testid="garage-panel"
    >
      <Panel
        title={G.title}
        icon={Warehouse}
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            aria-label={STRINGS.office.close}
            onClick={onClose}
          />
        }
      >
        <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel={G.title} />
        <ul className="mt-3 flex flex-col gap-2">
          {itemsOfTab(tab).length === 0 && <li className="text-sm text-slate-400">{G.empty}</li>}
          {itemsOfTab(tab).map((item) => {
            const paint = COSMETICS.find((c) => c.id === item.id);
            const owned = inventory.cosmetics.includes(item.id);
            const note =
              item.id === 'DRONE_T2'
                ? G.comboNote(comboOwned(inventory).map(itemName).join(', '))
                : undefined;
            return (
              <ShopItemCard
                key={item.id}
                item={item}
                state={cardState(item, ctx)}
                price={priceOf(item, shopPriceMod)}
                {...(note ? { note } : {})}
                {...(paint
                  ? {
                      swatches: [paint.colors.primary, paint.colors.secondary],
                      ...(owned
                        ? {
                            ownedAction: {
                              label:
                                inventory.equipped.dronePaint === item.id ? G.equipped : G.equip,
                              active: inventory.equipped.dronePaint === item.id,
                              onClick: () => useGameStore.getState().equip('dronePaint', item.id),
                            },
                          }
                        : {}),
                    }
                  : {})}
                onBuy={() => request(item)}
              />
            );
          })}
        </ul>
      </Panel>
      {pending && (
        <ConfirmDialog
          title={G.confirmTitle(pending.name)}
          message={[
            G.confirmMessage(formatBRL(priceOf(pending, shopPriceMod))),
            missingForCombo(pending) ? G.confirmCombo(missingForCombo(pending)) : '',
          ]
            .filter(Boolean)
            .join(' ')}
          confirmLabel={G.confirmButton}
          onConfirm={() => {
            useGameStore.getState().buyItem(pending.id);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
