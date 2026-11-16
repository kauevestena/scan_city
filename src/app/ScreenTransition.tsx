import { useState, type ReactNode } from 'react';
import { findContract } from '@/data/contracts';
import { useGameStore } from '@/state/store';
import type { GameStore } from '@/state/types';
import { cx } from '@/ui';
import { activeDimension } from '@/world/overworld/markers';

/** Duração do fade ao trocar de tela (`.screen-fade` e `.screen-rift` em `index.css`). */
export const SCREEN_FADE_MS = 200;

/** `NONE`: abertura do jogo; `FADE`: fade de 200 ms; `RIFT`: o mesmo fade com a "distorção" das fendas. */
export type TransitionKind = 'NONE' | 'FADE' | 'RIFT';

/** O contrato da tela atual: o do payload (`contractId`) ou o da missão a que ele se refere. */
function contractIdOf(s: GameStore): string | undefined {
  const payload = s.session.payload as { contractId?: unknown; missionId?: unknown } | undefined;
  if (typeof payload?.contractId === 'string') return payload.contractId;
  const missionId = payload?.missionId;
  if (typeof missionId !== 'string') return s.mission.active?.contractId;
  const mission =
    s.mission.active?.id === missionId
      ? s.mission.active
      : s.mission.pending.find((m) => m.id === missionId);
  return mission?.contractId;
}

/**
 * Está num contexto de fenda? O mapa com a aba Fendas aberta, ou uma tela da missão de um
 * contrato de fenda (planejamento, voo e processamento). Escritório, mesa e laboratório, não.
 */
export function inRiftContext(s: GameStore): boolean {
  switch (s.session.screen) {
    case 'WORLD_MAP':
      return activeDimension(s.world) === 'RIFT';
    case 'FIELD_SETUP':
    case 'SURVEY_FLIGHT':
    case 'PROCESSING_RESULTS': {
      const id = contractIdOf(s);
      return id !== undefined && findContract(id)?.dimension === 'RIFT';
    }
    default:
      return false;
  }
}

/**
 * Entrar ou sair de uma fenda ganha a distorção (violeta, ciano e um leve empenamento); o resto
 * é um fade simples. Com "Reduzir flashes e tremores" a distorção some e fica o fade.
 */
export function transitionKind(
  fromRift: boolean,
  toRift: boolean,
  reduceFlashes: boolean,
): TransitionKind {
  return (fromRift || toRift) && !reduceFlashes ? 'RIFT' : 'FADE';
}

/**
 * Envolve a tela atual: a cada troca de tela, ela entra com fade de 200 ms (REQ-UI-004). A tela
 * da abertura do jogo entra sem fade. `data-transition` diz qual transição rodou.
 */
export function ScreenTransition({ children }: { children: ReactNode }) {
  const screen = useGameStore((s) => s.session.screen);
  const rift = useGameStore(inRiftContext);
  const reduceFlashes = useGameStore((s) => s.settings.reduceFlashes);
  const [shown, setShown] = useState({ screen, rift, kind: 'NONE' as TransitionKind, count: 0 });
  if (shown.screen !== screen) {
    setShown({
      screen,
      rift,
      kind: transitionKind(shown.rift, rift, reduceFlashes),
      count: shown.count + 1,
    });
  } else if (shown.rift !== rift) {
    // Mesma tela, o contexto mudou (a aba Fendas do mapa): só acompanha, sem transição.
    setShown({ ...shown, rift });
  }
  return (
    <div
      key={shown.count}
      data-testid="screen-transition"
      data-transition={shown.kind}
      className={cx(
        'h-full w-full',
        shown.kind === 'FADE' && 'screen-fade',
        shown.kind === 'RIFT' && 'screen-rift',
      )}
    >
      {children}
    </div>
  );
}
