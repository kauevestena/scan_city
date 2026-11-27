import { Library, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { CONTRACTS } from '@/data/contracts';
import { SOUVENIRS } from '@/data/souvenirs';
import { STRINGS } from '@/data/strings';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { useGameStore } from '@/state/store';
import type { ContractProgress, Souvenir } from '@/types';
import { Button, cx, FOCUS_RING, Panel } from '@/ui';
import { SouvenirThumb } from './SouvenirThumb';
import { SouvenirViewer } from './SouvenirViewer';

const S = STRINGS.office.shelf;

export type ShelfSlotState = 'OBTAINED' | 'HINT' | 'UNKNOWN';

export interface ShelfSlot {
  souvenir: Souvenir;
  state: ShelfSlotState;
  /** Texto do nicho: o nome, "Conclua <título>" ou "???". */
  label: string;
}

/**
 * Os 18 nichos (office §5): obtido mostra nome e história; não obtido mostra "Conclua <título>"
 * se o contrato já está desbloqueado e "???" se ainda não (ou se o contrato não existe).
 */
export function shelfSlots(
  owned: readonly string[],
  contracts: Readonly<Record<string, ContractProgress>>,
): ShelfSlot[] {
  return SOUVENIRS.map((souvenir) => {
    if (owned.includes(souvenir.id)) return { souvenir, state: 'OBTAINED', label: souvenir.name };
    const contract = CONTRACTS.find((c) => c.id === souvenir.contractId);
    const status = contracts[souvenir.contractId]?.status;
    if (contract && status && status !== 'LOCKED') {
      return { souvenir, state: 'HINT', label: S.hint(contract.title) };
    }
    return { souvenir, state: 'UNKNOWN', label: S.unknown };
  });
}

/**
 * Estante de Relíquias (office §5): grade 6 × 3 com os 18 souvenirs, as miniaturas dos obtidos e
 * o **Examinar** (office §5.1): o souvenir em tela cheia. Escolher de novo o nicho escolhido
 * também examina.
 */
export function ShelfPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const owned = useGameStore((s) => s.souvenirs);
  const contracts = useGameStore((s) => s.contracts);
  const slots = shelfSlots(owned, contracts);
  const [selected, setSelected] = useState<string | null>(
    () => slots.find((s) => s.state === 'OBTAINED')?.souvenir.id ?? null,
  );
  const [examining, setExamining] = useState<Souvenir | null>(null);
  useFocusNavigation(ref, { onBack: onClose, autoFocus: true });
  const current = slots.find((s) => s.souvenir.id === selected);

  return (
    <div
      ref={ref}
      className="absolute top-0 right-0 bottom-0 w-96 overflow-y-auto p-3 min-[1600px]:w-[28rem]"
      data-testid="shelf-panel"
    >
      <Panel
        title={S.title}
        icon={Library}
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
        <p className="font-mono text-sm text-cyan-300" data-testid="shelf-count">
          {S.count(owned.length, SOUVENIRS.length)}
        </p>
        <ul className="mt-3 grid grid-cols-6 gap-1.5" data-testid="shelf-grid">
          {slots.map((slot, i) => (
            <li key={slot.souvenir.id}>
              <button
                type="button"
                data-focusable
                data-testid={`shelf-${slot.souvenir.id}`}
                data-state={slot.state}
                aria-label={
                  slot.state === 'OBTAINED' ? slot.souvenir.name : `${S.slot(i + 1)}: ${slot.label}`
                }
                aria-pressed={selected === slot.souvenir.id}
                onClick={() => {
                  if (selected === slot.souvenir.id && slot.state === 'OBTAINED') {
                    setExamining(slot.souvenir);
                  } else setSelected(slot.souvenir.id);
                }}
                className={cx(
                  'flex aspect-square w-full items-center justify-center rounded-md border bg-slate-800',
                  selected === slot.souvenir.id ? 'border-cyan-400' : 'border-slate-700',
                  slot.state !== 'OBTAINED' && 'text-slate-500',
                  FOCUS_RING,
                )}
                // A cor do souvenir vem dos dados (catalog §11).
                style={slot.state === 'OBTAINED' ? { color: slot.souvenir.color } : undefined}
              >
                {slot.state === 'OBTAINED' ? (
                  <SouvenirThumb souvenir={slot.souvenir} size={40} />
                ) : (
                  <span className="font-mono text-lg" aria-hidden>
                    ?
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <section
          className="mt-4 flex min-h-24 flex-col gap-1.5 rounded-md border border-slate-700 bg-slate-800 p-3"
          data-testid="shelf-detail"
          aria-live="polite"
        >
          {!current && <p className="text-sm text-slate-400">{S.empty}</p>}
          {current?.state === 'OBTAINED' && (
            <>
              <h3 className="font-semibold text-slate-100">{current.souvenir.name}</h3>
              <p className="text-sm text-slate-300">{current.souvenir.story}</p>
              <Button
                size="sm"
                icon={Search}
                className="mt-1 self-start"
                data-testid="shelf-examine"
                onClick={() => setExamining(current.souvenir)}
              >
                {S.examine}
              </Button>
            </>
          )}
          {current && current.state !== 'OBTAINED' && (
            <>
              <h3 className="text-sm text-slate-400">{S.locked}</h3>
              <p className="text-sm text-slate-200">{current.label}</p>
            </>
          )}
        </section>
      </Panel>
      {examining && <SouvenirViewer souvenir={examining} onClose={() => setExamining(null)} />}
    </div>
  );
}
