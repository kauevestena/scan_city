/**
 * Som de ambiente do voo (audio §3–§4): o `MOTOR` (multirrotor, asa fixa ou o "bater de asas" do
 * Atlas, com a frequência seguindo a velocidade) e o `WIND` (o ganho segue o vento). Os dois
 * loops começam com a tela, calam na pausa e param ao fim da surtida; o mudo e os volumes são do
 * `AudioEngine` (o master zerado silencia tudo).
 */
import type { AircraftKind } from '@/types';
import type { LoopHandle, LoopId, MotorVariant } from './sfx';

/** Motor por tipo de aeronave: o Atlas bate asas; a asa fixa tem o tom mais grave. */
export function motorVariantFor(kind: AircraftKind): MotorVariant {
  switch (kind) {
    case 'BIRD':
      return 'BIRD';
    case 'MULTIROTOR':
      return 'MULTIROTOR';
    case 'FIXED_WING_VTOL':
      return 'FIXED_WING';
  }
}

/** Vento cruzado de 12 m/s ou mais é o vento "cheio" do loop. */
export const WIND_FULL_MS = 12;

/** Intensidade 0..1 do `WIND` para o vento cruzado (m/s, com sinal). */
export function windIntensity(crossWindMs: number): number {
  return Math.min(1, Math.abs(crossWindMs) / WIND_FULL_MS);
}

/** O que o controlador precisa do `AudioEngine`. */
export interface LoopStarter {
  startLoop(id: LoopId, opts?: { variant?: MotorVariant }): LoopHandle;
}

export class FlightAmbience {
  private motor: LoopHandle | null = null;
  private wind: LoopHandle | null = null;
  private paused = false;
  private windLevel = 0;
  private speedMs = 10;

  constructor(
    private readonly audio: LoopStarter,
    private readonly kind: AircraftKind,
  ) {}

  get running(): boolean {
    return this.motor !== null;
  }

  /** Liga os loops (idempotente; o StrictMode monta, desmonta e monta de novo). */
  start(): void {
    if (this.motor) return;
    this.motor = this.audio.startLoop('MOTOR', { variant: motorVariantFor(this.kind) });
    this.wind = this.audio.startLoop('WIND');
    this.motor.setParam('rate', this.speedMs);
    this.applyPause();
  }

  /** A velocidade e o vento cruzado de cada quadro do HUD. */
  update(speedMs: number, crossWindMs: number): void {
    this.speedMs = speedMs;
    this.windLevel = windIntensity(crossWindMs);
    this.motor?.setParam('rate', speedMs);
    if (!this.paused) this.wind?.setParam('gain', this.windLevel);
  }

  /** Na pausa os dois calam; ao retomar, voltam ao nível de antes. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyPause();
  }

  private applyPause(): void {
    this.motor?.setParam('gain', this.paused ? 0 : 1);
    this.wind?.setParam('gain', this.paused ? 0 : this.windLevel);
  }

  stop(fadeS = 0.3): void {
    this.motor?.stop(fadeS);
    this.wind?.stop(fadeS);
    this.motor = null;
    this.wind = null;
  }
}
