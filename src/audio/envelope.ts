/** Menor ganho usado nas rampas exponenciais, que não podem chegar a 0 (audio §2). */
export const MIN_GAIN = 0.0001;

export interface EnvelopeSpec {
  /** Ataque (s), rampa linear até `peak`. */
  a: number;
  /** Decaimento (s), rampa exponencial até `s · peak`. */
  d: number;
  /** Nível de sustentação, fração de `peak` (0 = sem sustentação). */
  s?: number;
  /** Release (s), rampa exponencial até o mínimo. */
  r?: number;
  peak: number;
  /** Duração da sustentação (s). */
  sustainTime?: number;
}

/**
 * Envelope ADSR num `AudioParam` a partir de `t0`: ataque linear e decaimento/release
 * exponenciais, nunca até 0. Devolve o instante em que o envelope termina.
 */
export function env(param: AudioParam, t0: number, spec: EnvelopeSpec): number {
  const { a, d, s = 0, r = 0, peak, sustainTime = 0 } = spec;
  const top = Math.max(MIN_GAIN, peak);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(MIN_GAIN, t0);
  if (a > 0) param.linearRampToValueAtTime(top, t0 + a);
  else param.setValueAtTime(top, t0);

  let t = t0 + a;
  const level = s > 0 ? Math.max(MIN_GAIN, top * s) : MIN_GAIN;
  if (d > 0) {
    t += d;
    param.exponentialRampToValueAtTime(level, t);
  }
  if (s > 0) {
    t += sustainTime;
    param.setValueAtTime(level, t);
    if (r > 0) {
      t += r;
      param.exponentialRampToValueAtTime(MIN_GAIN, t);
    } else {
      param.setValueAtTime(MIN_GAIN, t);
    }
  }
  return t;
}
