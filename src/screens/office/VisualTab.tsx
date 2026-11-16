import { useState } from 'react';
import { COSMETICS, EMBLEM_PALETTE } from '@/data/cosmetics';
import { STRINGS } from '@/data/strings';
import { SHOP_ITEMS } from '@/domain/economy';
import {
  EMBLEM_ICONS,
  EMBLEM_SHAPES,
  MAX_INITIALS,
  sanitizeInitials,
  validInitials,
} from '@/domain/emblem';
import { unlockStateFrom } from '@/domain/progression';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import type { Emblem } from '@/types';
import { ConfirmDialog, cx, EmblemBadge, FOCUS_RING } from '@/ui';
import { formatBRL } from '@/lib/format';
import { ShopItemCard } from './ShopItemCard';
import { cardState, priceOf } from './shopModel';
import type { ShopItem } from '@/domain/economy';

const V = STRINGS.office.career.visual;
const G = STRINGS.office.garage;

const SKINS = SHOP_ITEMS.filter(
  (i) => i.kind === 'COSMETIC' && COSMETICS.find((c) => c.id === i.id)?.slot === 'CHARACTER',
);

function Swatches({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: (hex: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" data-testid={`palette-${label}`}>
      <legend className="text-xs text-slate-400">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {EMBLEM_PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            data-focusable
            aria-label={V.color(label, hex)}
            aria-pressed={value === hex}
            onClick={() => onPick(hex)}
            className={cx(
              'size-6 rounded-sm border',
              value === hex ? 'border-cyan-300 ring-2 ring-cyan-300' : 'border-slate-600',
              FOCUS_RING,
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Editor de emblema com pré-visualização ao vivo; cada mudança válida já é gravada (e salva). */
function EmblemEditor() {
  const emblem = useGameStore((s) => s.inventory.emblem);
  // O texto digitado pode estar inválido (vazio) sem mexer no emblema gravado.
  const [draft, setDraft] = useState(emblem.initials);
  const commit = (next: Partial<Emblem>) =>
    useGameStore.getState().setEmblem({ ...emblem, ...next });
  const valid = validInitials(draft);

  return (
    <section className="flex flex-col gap-3" data-testid="emblem-editor">
      <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{V.emblem}</h3>
      <div className="flex items-center gap-4">
        <div data-testid="emblem-preview">
          <EmblemBadge emblem={emblem} size={72} title={V.preview} />
        </div>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {V.initials}
          <input
            type="text"
            value={draft}
            maxLength={MAX_INITIALS}
            aria-invalid={!valid}
            aria-describedby="initials-hint"
            data-focusable
            className={cx(
              'w-24 rounded-md border bg-slate-800 px-2 py-1 font-mono text-base text-slate-100 uppercase',
              valid ? 'border-slate-600' : 'border-rose-500',
              FOCUS_RING,
            )}
            onChange={(e) => {
              const next = sanitizeInitials(e.target.value);
              setDraft(next);
              if (validInitials(next)) commit({ initials: next });
            }}
          />
          <span id="initials-hint" className={valid ? 'text-slate-400' : 'text-rose-400'}>
            {V.initialsHint}
          </span>
        </label>
      </div>
      <fieldset className="flex flex-col gap-1.5" data-testid="emblem-shapes">
        <legend className="text-xs text-slate-400">{V.shape}</legend>
        <div className="flex flex-wrap gap-1.5">
          {EMBLEM_SHAPES.map((shape) => (
            <button
              key={shape}
              type="button"
              data-focusable
              aria-pressed={emblem.shape === shape}
              onClick={() => commit({ shape })}
              className={cx(
                'rounded-md border px-2 py-1 text-xs',
                emblem.shape === shape
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-slate-600 text-slate-300',
                FOCUS_RING,
              )}
            >
              {V.shapes[shape]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5" data-testid="emblem-icons">
        <legend className="text-xs text-slate-400">{V.icon}</legend>
        <div className="flex flex-wrap gap-1.5">
          {EMBLEM_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              data-focusable
              aria-pressed={emblem.icon === icon}
              onClick={() => commit({ icon })}
              className={cx(
                'rounded-md border px-2 py-1 text-xs',
                emblem.icon === icon
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-slate-600 text-slate-300',
                FOCUS_RING,
              )}
            >
              {V.icons[icon]}
            </button>
          ))}
        </div>
      </fieldset>
      <Swatches
        label={V.primary}
        value={emblem.primary}
        onPick={(primary) => commit({ primary })}
      />
      <Swatches
        label={V.secondary}
        value={emblem.secondary}
        onPick={(secondary) => commit({ secondary })}
      />
    </section>
  );
}

/** Aba Visual do Quadro de Carreira (office §5): skins do personagem e o editor de emblema. */
export function VisualTab() {
  const player = useGameStore((s) => s.player);
  const contracts = useGameStore((s) => s.contracts);
  const inventory = useGameStore((s) => s.inventory);
  const shopPriceMod = useGameStore((s) => selectModifiers(s).shopPrice);
  const [pending, setPending] = useState<ShopItem | null>(null);
  const ctx = {
    money: player.money,
    inventory,
    unlock: unlockStateFrom({ contracts, player, inventory }),
    shopPriceMod,
  };
  return (
    <div className="mt-3 flex flex-col gap-5" data-testid="visual-tab">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {V.skins}
        </h3>
        <ul className="flex flex-col gap-2">
          {SKINS.map((item) => {
            const cosmetic = COSMETICS.find((c) => c.id === item.id);
            const owned = inventory.cosmetics.includes(item.id);
            const equipped = inventory.equipped.character === item.id;
            return (
              <ShopItemCard
                key={item.id}
                item={item}
                state={cardState(item, ctx)}
                price={priceOf(item, shopPriceMod)}
                {...(cosmetic
                  ? { swatches: [cosmetic.colors.primary, cosmetic.colors.secondary] }
                  : {})}
                {...(owned
                  ? {
                      ownedAction: {
                        label: equipped ? G.equipped : G.equip,
                        active: equipped,
                        onClick: () => useGameStore.getState().equip('character', item.id),
                      },
                    }
                  : {})}
                onBuy={() => setPending(item)}
              />
            );
          })}
        </ul>
      </section>
      <EmblemEditor />
      {pending && (
        <ConfirmDialog
          title={G.confirmTitle(pending.name)}
          message={G.confirmMessage(formatBRL(priceOf(pending, shopPriceMod)))}
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
