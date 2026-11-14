import { Bird, Camera, Wheat, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ATLAS_RULES } from '@/data/catalog';
import { COSMETICS } from '@/data/cosmetics';
import { STRINGS } from '@/data/strings';
import { unlockStateFrom } from '@/domain/progression';
import { SHOP_ITEMS, type ShopItem } from '@/domain/economy';
import { CROP_CAPACITY } from '@/domain/sorties';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { formatBRL } from '@/lib/format';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { Button, ConfirmDialog, Panel, ProgressBar } from '@/ui';
import { ShopItemCard } from './ShopItemCard';
import { cardState, priceOf } from './shopModel';

const T = STRINGS.office.perchPanel;
/** Duração da animação de calibração (office §5). */
export const CALIBRATION_MS = 2000;

const ACCESSORIES: readonly ShopItem[] = SHOP_ITEMS.filter(
  (i) => i.kind === 'COSMETIC' && COSMETICS.find((c) => c.id === i.id)?.slot === 'ATLAS_ACCESSORY',
);

/** Poleiro do Atlas (office §5, catalog §8): milho, papo, calibração da câmera e acessórios. */
export function PerchPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [pending, setPending] = useState<ShopItem | null>(null);
  const corn = useGameStore((s) => s.inventory.corn);
  const flights = useGameStore((s) => s.inventory.atlasCalibrationFlights);
  const player = useGameStore((s) => s.player);
  const contracts = useGameStore((s) => s.contracts);
  const inventory = useGameStore((s) => s.inventory);
  const shopPriceMod = useGameStore((s) => selectModifiers(s).shopPrice);
  useFocusNavigation(ref, { onBack: onClose, active: pending === null });

  // A calibração leva 2 s, com a barra avançando a cada 100 ms; ao fim, vale por 3 voos.
  const [calProgress, setCalProgress] = useState(0);
  useEffect(() => {
    if (!calibrating) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      if (elapsed >= CALIBRATION_MS) {
        window.clearInterval(timer);
        useGameStore.getState().calibrateAtlas();
        setCalProgress(0);
        setCalibrating(false);
      } else {
        setCalProgress(elapsed / CALIBRATION_MS);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [calibrating]);

  const full = corn.crop >= CROP_CAPACITY;
  const noCorn = corn.stock <= 0;
  const feedBlocked = full ? T.feedFull : noCorn ? T.feedNeedCorn : null;
  const ctx = {
    money: player.money,
    inventory,
    unlock: unlockStateFrom({ contracts, player, inventory }),
    shopPriceMod,
  };

  return (
    <div
      ref={ref}
      className="absolute top-0 right-0 bottom-0 w-80 overflow-y-auto p-3 min-[1600px]:w-[380px]"
      data-testid="perch-panel"
    >
      <Panel
        title={T.title}
        icon={Bird}
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
        <section className="flex flex-col gap-2" data-testid="corn-gauge">
          <div className="flex items-baseline justify-between font-mono text-sm">
            <span className="text-slate-100" data-testid="crop-value">
              {T.crop(corn.crop, CROP_CAPACITY)}
            </span>
            <span className="text-cyan-300" data-testid="stock-value">
              {T.stock(corn.stock)}
            </span>
          </div>
          <ProgressBar value={corn.crop / CROP_CAPACITY} />
          <p className="text-xs text-slate-400">{T.cropHint}</p>
          <div className="flex flex-wrap gap-2">
            {ATLAS_RULES.cornPacks.map((pack) => (
              <Button
                key={pack}
                size="sm"
                variant="secondary"
                icon={Wheat}
                data-focus-id={`buy-corn-${pack}`}
                onClick={() => useGameStore.getState().buyCorn(pack)}
              >
                {T.buy(pack, formatBRL(ATLAS_RULES.cornPriceBRL * pack))}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={feedBlocked !== null}
            title={feedBlocked ?? undefined}
            onClick={() => useGameStore.getState().feedAtlas()}
          >
            {T.feed}
          </Button>
          {feedBlocked && (
            <p className="text-xs text-amber-300" data-testid="feed-hint">
              {feedBlocked}
            </p>
          )}
        </section>

        <section className="mt-4 flex flex-col gap-2" data-testid="calibration">
          <p className="font-mono text-sm text-slate-200" data-testid="calibration-status">
            {T.calibration(flights)}
          </p>
          <p className="text-xs text-slate-400">{T.calibrationHint}</p>
          {calibrating && <ProgressBar value={calProgress} striped animated />}
          <Button
            size="sm"
            variant="secondary"
            icon={Camera}
            disabled={calibrating}
            onClick={() => setCalibrating(true)}
          >
            {calibrating ? T.calibrating : T.calibrate}
          </Button>
        </section>

        <section className="mt-4 flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
            {T.accessories}
          </h3>
          <ul className="flex flex-col gap-2">
            {ACCESSORIES.map((item) => {
              const cosmetic = COSMETICS.find((c) => c.id === item.id);
              const owned = inventory.cosmetics.includes(item.id);
              const equipped = inventory.equipped.atlasAccessory === item.id;
              return (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  state={cardState(item, ctx)}
                  price={priceOf(item, shopPriceMod)}
                  swatches={
                    cosmetic && item.id !== 'ATLAS_NONE'
                      ? [cosmetic.colors.primary, cosmetic.colors.secondary]
                      : []
                  }
                  {...(owned
                    ? {
                        ownedAction: {
                          label: equipped
                            ? STRINGS.office.garage.equipped
                            : STRINGS.office.garage.equip,
                          active: equipped,
                          onClick: () => useGameStore.getState().equip('atlasAccessory', item.id),
                        },
                      }
                    : {})}
                  onBuy={() => setPending(item)}
                />
              );
            })}
          </ul>
        </section>
      </Panel>
      {pending && (
        <ConfirmDialog
          title={STRINGS.office.garage.confirmTitle(pending.name)}
          message={STRINGS.office.garage.confirmMessage(formatBRL(priceOf(pending, shopPriceMod)))}
          confirmLabel={STRINGS.office.garage.confirmButton}
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
