import { useSyncExternalStore } from 'react';
import { OWNER_COFFEE_COST, TIRE_REPAIR_TAPS, TOW_COST } from '@/data/fieldEvents';
import { STRINGS } from '@/data/strings';
import type { FieldEventRuntime } from '@/engines/overworld/fieldEventRuntime';
import { InputGlyph } from '@/input/InputGlyph';
import { formatBRL, formatNumber } from '@/lib/format';
import { useGameStore } from '@/state/store';
import { Button, Modal, ProgressBar } from '@/ui';

const E = STRINGS.world.events;

/** Estado do evento em curso, como fonte externa (re-renderiza só quando ele muda). */
export function useFieldEvent(runtime: FieldEventRuntime) {
  return useSyncExternalStore(runtime.subscribe, () => runtime.state);
}

/** Modal pequeno dos eventos com escolha ou diálogo (world-map §5.5): pneu, marco e proprietário. */
export function FieldEventModal({ runtime }: { runtime: FieldEventRuntime }) {
  const state = useFieldEvent(runtime);
  const money = useGameStore((s) => s.player.money);
  if (!state || state.id === 'CATTLE') return null;

  if (state.id === 'FLAT_TIRE') {
    const repairing = state.phase === 'REPAIR';
    return (
      <Modal open title={E.FLAT_TIRE.title} size="sm" dismissable={false}>
        <div className="flex flex-col gap-4" data-testid="field-event-modal" data-event="FLAT_TIRE">
          {repairing ? (
            <div className="flex flex-col gap-2" data-testid="tire-repair">
              <p className="text-sm text-slate-200">{E.FLAT_TIRE.repairing}</p>
              <ProgressBar value={state.taps / TIRE_REPAIR_TAPS} />
              <p className="flex items-center gap-2 font-mono text-xs text-slate-300">
                <InputGlyph
                  action="INTERACT"
                  label={E.FLAT_TIRE.repairHint(state.taps, TIRE_REPAIR_TAPS)}
                />
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-200">{E.FLAT_TIRE.body}</p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => runtime.chooseTire('REPAIR')}>{E.FLAT_TIRE.repair}</Button>
                <Button
                  variant="secondary"
                  disabled={money < TOW_COST}
                  onClick={() => runtime.chooseTire('TOW')}
                >
                  {E.FLAT_TIRE.tow(formatBRL(TOW_COST))}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    );
  }

  if (state.id === 'LOST_BENCHMARK') {
    return (
      <Modal open title={E.LOST_BENCHMARK.title} size="sm" dismissable={false}>
        <div
          className="flex flex-col gap-4"
          data-testid="field-event-modal"
          data-event="LOST_BENCHMARK"
        >
          <p className="text-sm text-slate-200">{E.LOST_BENCHMARK.body}</p>
          <Button onClick={() => runtime.acknowledge()}>{E.LOST_BENCHMARK.ok}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open title={E.SUSPICIOUS_OWNER.title} size="sm" dismissable={false}>
      <div
        className="flex flex-col gap-4"
        data-testid="field-event-modal"
        data-event="SUSPICIOUS_OWNER"
      >
        <p className="text-sm text-slate-200 italic">{E.SUSPICIOUS_OWNER.body}</p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => runtime.chooseOwner('SHOW')}>{E.SUSPICIOUS_OWNER.show}</Button>
          <Button
            variant="secondary"
            disabled={money < OWNER_COFFEE_COST}
            onClick={() => runtime.chooseOwner('COFFEE')}
          >
            {E.SUSPICIOUS_OWNER.coffee(formatBRL(OWNER_COFFEE_COST))}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Aviso do gado na pista: bloqueio de 3 s, com buzina em `INTERACT`. */
export function CattleBanner({ runtime }: { runtime: FieldEventRuntime }) {
  const state = useFieldEvent(runtime);
  if (state?.id !== 'CATTLE') return null;
  return (
    <div
      role="status"
      data-testid="cattle-banner"
      className="pointer-events-none absolute inset-x-0 top-24 flex justify-center"
    >
      <span className="flex items-center gap-3 rounded-lg border border-amber-400/60 bg-slate-950/90 px-4 py-2 text-sm text-amber-100">
        {E.CATTLE.banner(formatNumber(state.remainingS, 1))}
        <InputGlyph action="INTERACT" label={STRINGS.world.honk} />
      </span>
    </div>
  );
}
