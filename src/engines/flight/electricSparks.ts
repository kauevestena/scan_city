/**
 * Faíscas das criaturas elétricas (contracts-rifts R09): durante um pico (`ELECTRIC_CREATURES`),
 * faíscas amarelas sobem do capim do lado da criatura, que é o oposto ao do empurrão. O desenho
 * é determinístico: depende só do tempo e do instante em que o pico começou.
 */
import { clamp } from '@/lib/math';
import { hash2 } from '@/lib/rng';
import type { Spike } from './fieldElements';

export const SPARK_COUNT = 28;
const SEED = 0x3e1ec;

/** Desenha as faíscas do pico ativo (nada fora de um pico). */
export function drawElectricSparks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  spike: Spike | null,
  timeS: number,
): void {
  if (!spike) return;
  const age = clamp((timeS - spike.startS) / (spike.endS - spike.startS), 0, 1);
  // O pico sobe e some: sem faíscas na hora exata em que começa e em que termina.
  const fade = Math.sin(Math.PI * age);
  const salt = Math.round(spike.startS * 10) * 8;
  for (let i = 0; i < SPARK_COUNT; i++) {
    const h = (k: number) => hash2(i, k + salt, SEED);
    // A criatura está do lado oposto ao do empurrão.
    const x = width * (0.5 - spike.side * (0.05 + 0.45 * h(0)));
    const y0 = horizonY + (height - horizonY) * (0.45 + 0.5 * h(1));
    // Cada faísca tem a sua fase: sobe e some antes de recomeçar.
    const rise = (age + h(2)) % 1;
    const y = y0 - rise * (60 + 120 * h(3));
    ctx.fillStyle = `rgba(250, 204, 21, ${(0.9 * fade * (1 - rise)).toFixed(3)})`;
    ctx.fillRect(x, y, 2 + 2 * h(4), 5 + 5 * h(5));
  }
}
