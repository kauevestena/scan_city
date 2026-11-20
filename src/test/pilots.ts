/**
 * Pilotos simulados das metas de desafio (ADR-032, REQ-NFR-010). Cada um é uma fonte de
 * entrada para o `FlightEngine`, lida a cada passo de física:
 * - **parado:** nenhum comando (só o RTH quando o alarme toca, que o voo faz por fora);
 * - **mediano:** enxerga a faixa, a altura e a velocidade no solo com 0,35 s de atraso,
 *   comanda tudo ou nada (como num teclado), com folga, e de vez em quando se distrai por 1 s;
 * - **bom:** o autopilot de depuração (não passa por aqui);
 * - **distraído:** o mediano que só pilota na entrada de cada linha (até 2 s depois do início
 *   da AOI) e depois larga o controle. Não pode passar: é o voo que só exige um gesto por linha.
 */
import type { FlightEngine, FlightInputSource } from '@/engines/flight/FlightEngine';
import { mulberry32 } from '@/lib/rng';

export type PilotKind = 'IDLE' | 'MEDIUM' | 'GOOD' | 'ALIGN';

/** Passo de física do jogo: 60 Hz. */
export const PILOT_STEP_S = 1 / 60;

export const MEDIUM = {
  /** Atraso entre ver e reagir. */
  reactionS: 0.35,
  /** Folga antes de reagir: fração de S (faixa) e de H (altura). */
  lateralDeadband: 0.05,
  verticalDeadband: 0.05,
  /** Velocidade no solo tolerada antes de reagir (fração da do plano). */
  speedDeadband: 0.06,
  /** Antecipação da faixa: o jogador mediano não antecipa, só reage ao que já aconteceu. */
  lateralLeadS: 0,
  /** Distrações: chance por segundo e duração. */
  lapsePerS: 0.04,
  lapseS: 1,
} as const;

interface Observation {
  x: number;
  vx: number;
  dz: number;
  speedRatio: number;
}

/** Fonte de entrada nula: o jogador parado. */
export const idlePilot: FlightInputSource = { axis: () => 0 };

/**
 * O jogador mediano. `attach` liga o piloto ao motor; `tick` é chamado uma vez por passo,
 * antes do `update`, para registrar o que o jogador vê e decidir o comando.
 */
export class MediumPilot implements FlightInputSource {
  private engine: FlightEngine | null = null;
  private readonly seen: Observation[] = [];
  private readonly rng;
  private lapseLeft = 0;
  private command = { moveX: 0, moveY: 0, altUp: 0, altDown: 0 };

  constructor(
    seed: number,
    private readonly plan: { speedMs: number; spacingM: number; heightM: number },
    /** Só pilota na entrada de cada linha (o jogador distraído). */
    private readonly alignOnly = false,
  ) {
    this.rng = mulberry32(seed);
  }

  attach(engine: FlightEngine): void {
    this.engine = engine;
  }

  tick(): void {
    const e = this.engine;
    if (!e) return;
    const plan = this.plan;
    this.seen.push({
      x: e.ac.x,
      vx: e.ac.vLat + e.ac.drift,
      dz: e.corridorAlt() - e.ac.alt,
      speedRatio: e.ac.gs / Math.max(0.1, plan.speedMs),
    });
    const delay = Math.round(MEDIUM.reactionS / PILOT_STEP_S);
    if (this.seen.length > delay + 1) this.seen.shift();
    if (this.lapseLeft > 0) {
      this.lapseLeft -= PILOT_STEP_S;
      this.command = { moveX: 0, moveY: 0, altUp: 0, altDown: 0 };
      return;
    }
    if (e.phase === 'RUN' && this.rng.next() < MEDIUM.lapsePerS * PILOT_STEP_S) {
      this.lapseLeft = MEDIUM.lapseS;
      return;
    }
    const o = this.seen[0];
    const entering = (e.line?.aoiStartS ?? 0) + 2 * plan.speedMs;
    if (!o || e.phase !== 'RUN' || (this.alignOnly && e.ac.s > entering)) {
      this.command = { moveX: 0, moveY: 0, altUp: 0, altDown: 0 };
      return;
    }
    const ahead = o.x + o.vx * MEDIUM.lateralLeadS;
    const lat = MEDIUM.lateralDeadband * plan.spacingM;
    const vert = MEDIUM.verticalDeadband * plan.heightM;
    this.command = {
      moveX: ahead > lat ? -1 : ahead < -lat ? 1 : 0,
      moveY:
        o.speedRatio > 1 + MEDIUM.speedDeadband
          ? -1
          : o.speedRatio < 1 - MEDIUM.speedDeadband
            ? 1
            : 0,
      altUp: o.dz > vert ? 1 : 0,
      altDown: o.dz < -vert ? 1 : 0,
    };
  }

  axis(a: 'MOVE_X' | 'MOVE_Y' | 'ALT_UP' | 'ALT_DOWN'): number {
    if (a === 'MOVE_X') return this.command.moveX;
    if (a === 'MOVE_Y') return this.command.moveY;
    if (a === 'ALT_UP') return this.command.altUp;
    return this.command.altDown;
  }
}
