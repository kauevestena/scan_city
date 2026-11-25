/**
 * Pilotos simulados das metas de desafio (ADR-032, REQ-NFR-010). Cada um é uma fonte de
 * entrada para o `FlightEngine`, lida a cada passo de física:
 * - **parado:** nenhum comando (só o RTH quando o alarme toca, que o voo faz por fora);
 * - **mediano:** enxerga a faixa, a altura e a velocidade no solo com 0,35 s de atraso,
 *   comanda tudo ou nada (como num teclado), com folga, e de vez em quando se distrai por 1 s.
 *   Os tempos dele são **reais** (ADR-034): no ritmo ×2 do voo, 0,35 s de reação são 0,7 s de
 *   simulação. Ele tenta o contragolpe em cada frente de vento que vê, com erro de tempo;
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
  /**
   * Antecipação da faixa e da altura (tempo real): ele solta o comando um pouco antes de chegar
   * ao eixo ou à altura do corredor, pela velocidade com que a aeronave chega lá (no ritmo do
   * voo, segurar até ver o cruzamento passaria da faixa inteira).
   */
  lateralLeadS: 0.15,
  /** Distrações: chance por segundo e duração. */
  lapsePerS: 0.04,
  lapseS: 1,
  /**
   * Contragolpe: ele vê a frente de vento chegar e toca contra ela, com erro de tempo normal
   * (atraso médio de 80 ms e desvio de 150 ms, tempo real): acerta a janela cerca de metade das
   * vezes. Solta o comando um instante antes, para o toque ser um começo novo.
   */
  counterBiasS: 0.08,
  counterSigmaS: 0.15,
  counterTapS: 0.12,
  counterReleaseS: 0.05,
} as const;

interface Observation {
  /** Instante real em que o jogador viu isto. */
  atS: number;
  x: number;
  vx: number;
  dz: number;
  /** Quanto `dz` muda por segundo (simulação): o corredor que sobe menos a subida da aeronave. */
  vdz: number;
  speedRatio: number;
}

/** Fonte de entrada nula: o jogador parado. */
export const idlePilot: FlightInputSource = { axis: () => 0 };

/**
 * O jogador mediano. `attach` liga o piloto ao motor; `tick(realDtS)` é chamado uma vez por
 * passo, antes do `update`, com o tempo real que o passo representa, para registrar o que o
 * jogador vê e decidir o comando.
 */
export class MediumPilot implements FlightInputSource {
  private engine: FlightEngine | null = null;
  private readonly seen: Observation[] = [];
  private readonly rng;
  private lapseLeft = 0;
  private clockS = 0;
  /** O toque contra a rajada que vem: o instante (relógio real) e o lado do comando. */
  private tap: { atS: number; moveX: -1 | 1 } | null = null;
  /** A frente de vento que ele já viu (para tocar uma vez por rajada). */
  private sawFront = false;
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

  tick(realDtS: number = PILOT_STEP_S): void {
    const e = this.engine;
    if (!e) return;
    const plan = this.plan;
    this.clockS += realDtS;
    this.seen.push({
      atS: this.clockS,
      x: e.ac.x,
      vx: e.ac.vLat + e.ac.drift,
      dz: e.corridorAlt() - e.ac.alt,
      vdz: (e.corridorAlt(e.ac.s + e.ac.gs * 0.1) - e.corridorAlt()) / 0.1 - e.ac.vz,
      speedRatio: e.ac.gs / Math.max(0.1, plan.speedMs),
    });
    // Fica com a observação mais recente que já tem o atraso de reação (tempo real).
    while (
      this.seen.length > 1 &&
      (this.seen[1] as Observation).atS <= this.clockS - MEDIUM.reactionS
    )
      this.seen.shift();
    if (this.lapseLeft > 0) {
      this.lapseLeft -= realDtS;
      this.command = { moveX: 0, moveY: 0, altUp: 0, altDown: 0 };
      return;
    }
    if (e.phase === 'RUN' && this.rng.next() < MEDIUM.lapsePerS * realDtS) {
      this.lapseLeft = MEDIUM.lapseS;
      return;
    }
    const first = this.seen[0];
    const o = first && first.atS <= this.clockS - MEDIUM.reactionS + 1e-9 ? first : undefined;
    const entering = (e.line?.aoiStartS ?? 0) + 2 * plan.speedMs;
    if (!o || e.phase !== 'RUN' || (this.alignOnly && e.ac.s > entering)) {
      this.command = { moveX: 0, moveY: 0, altUp: 0, altDown: 0 };
      return;
    }
    // A antecipação é de tempo real: em simulação, vale o ritmo do voo vezes mais.
    const ahead = o.x + o.vx * MEDIUM.lateralLeadS * e.timeScale;
    const dzAhead = o.dz + o.vdz * MEDIUM.lateralLeadS * e.timeScale;
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
      altUp: dzAhead > vert ? 1 : 0,
      altDown: dzAhead < -vert ? 1 : 0,
    };
    this.counterTap(e);
  }

  /** O contragolpe: marca o toque ao ver a frente e, na hora, solta e toca contra a rajada. */
  private counterTap(e: FlightEngine): void {
    const gust = e.gustNow();
    const warned = gust !== null && !gust.active;
    if (warned && !this.sawFront && !this.alignOnly) {
      // Tempo real até a chegada, mais o erro de quem antecipa um movimento que vê.
      const toImpactS = gust.inS / Math.max(1e-9, e.timeScale);
      this.tap = {
        atS: this.clockS + toImpactS + MEDIUM.counterBiasS + this.gauss() * MEDIUM.counterSigmaS,
        moveX: gust.side > 0 ? -1 : 1,
      };
    }
    this.sawFront = warned;
    const tap = this.tap;
    if (!tap) return;
    const d = this.clockS - tap.atS;
    if (d >= -MEDIUM.counterReleaseS && d < 0) this.command.moveX = 0;
    else if (d >= 0 && d < MEDIUM.counterTapS) this.command.moveX = tap.moveX;
    else if (d >= MEDIUM.counterTapS) this.tap = null;
  }

  /** Normal padrão (Box-Muller) pelo gerador seedado. */
  private gauss(): number {
    const u = Math.max(1e-12, this.rng.next());
    const v = this.rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  axis(a: 'MOVE_X' | 'MOVE_Y' | 'ALT_UP' | 'ALT_DOWN'): number {
    if (a === 'MOVE_X') return this.command.moveX;
    if (a === 'MOVE_Y') return this.command.moveY;
    if (a === 'ALT_UP') return this.command.altUp;
    return this.command.altDown;
  }
}
