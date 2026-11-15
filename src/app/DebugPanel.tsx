import { ArrowRight, Banknote, Bug, Inbox, MapPin } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import { transitionsFrom } from '@/state/machine';
import { useGameStore } from '@/state/store';
import { Button, Panel } from '@/ui';
import { markerViews } from '@/world/overworld/markers';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { createDebugMission, DEBUG_CONTRACT_ID, prepareDebugTransition } from './debugFixtures';
import { getDebugFlags } from './debugFlags';

const GRANT_CENTS = 1_000_000;

/**
 * Painel de depuração (architecture §7): resumo da store, um botão por transição
 * válida a partir da tela atual e ações rápidas.
 */
export function DebugPanel() {
  const screen = useGameStore((s) => s.session.screen);
  const payload = useGameStore((s) => s.session.payload);
  const money = useGameStore((s) => s.player.money);
  const level = useGameStore((s) => s.player.level);
  const reputation = useGameStore((s) => s.player.reputation);
  const pending = useGameStore((s) => s.mission.pending.length);
  const active = useGameStore((s) => s.mission.active?.id ?? null);
  const contractId = getDebugFlags().contract ?? DEBUG_CONTRACT_ID;
  const contracts = useGameStore((s) => s.contracts);
  const markers = screen === 'WORLD_MAP' ? markerViews(contracts, 'REAL', []) : [];

  const summary = { screen, payload: payload ?? null, level, reputation, pending, active };

  return (
    <Panel title="Depuração" icon={Bug} className="w-[28rem] max-w-full">
      <div className="flex flex-col gap-4 text-sm">
        <p className="font-mono text-slate-300" data-testid="debug-money">
          Saldo: {formatBRL(money)}
        </p>
        <pre
          className="max-h-40 overflow-auto rounded-md bg-slate-950 p-3 font-mono text-xs text-cyan-300"
          data-testid="debug-state"
        >
          {JSON.stringify(summary, null, 2)}
        </pre>
        <div>
          <p className="mb-2 text-xs tracking-widest text-slate-400 uppercase">Transições</p>
          <div className="flex flex-col gap-2">
            {transitionsFrom(screen).map((def) => (
              <Button
                key={def.id}
                icon={ArrowRight}
                className="justify-start"
                data-transition={def.id}
                title={def.trigger}
                onClick={() => {
                  const next = prepareDebugTransition(def, contractId);
                  useGameStore.getState().goTo(def.to, next);
                }}
              >
                {def.id} → {def.to}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs tracking-widest text-slate-400 uppercase">Ações rápidas</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={Banknote}
              onClick={() => useGameStore.getState().earn(GRANT_CENTS, 'Depuração')}
            >
              + {formatBRL(GRANT_CENTS)}
            </Button>
            <Button
              size="sm"
              icon={Inbox}
              onClick={() =>
                useGameStore.setState((s) => ({
                  mission: {
                    ...s.mission,
                    pending: [...s.mission.pending, createDebugMission(contractId, true)],
                  },
                }))
              }
            >
              Gerar missão pendente
            </Button>
          </div>
        </div>
        {markers.length > 0 && (
          <div>
            <p className="mb-2 text-xs tracking-widest text-slate-400 uppercase">
              Teleportar para marcador
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={MapPin}
                data-teleport="HQ"
                onClick={() =>
                  useGameStore
                    .getState()
                    .setAvatar({ x: WORLD_MAP.door.x + 0.5, y: WORLD_MAP.door.y + 0.5 })
                }
              >
                Sede
              </Button>
              {markers.map((m) => (
                <Button
                  key={m.contractId}
                  size="sm"
                  icon={MapPin}
                  data-teleport={m.contractId}
                  onClick={() => useGameStore.getState().setAvatar({ x: m.x + 0.5, y: m.y + 0.5 })}
                >
                  {m.contractId}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
