/**
 * Partículas do clima (survey-flight §5.5): neve com o vento (BLIZZARD) e vaga-lumes
 * (MAGIC_FOG), em espaço de tela, no máximo 300. Determinístico (RNG seedado).
 */
import { mulberry32, type Rng } from '@/lib/rng';
import type { LightingId } from '@/types';

export const MAX_PARTICLES = 300;
/** Pixels por segundo de deriva para cada m/s de vento cruzado. */
export const WIND_PX_PER_MS = 14;
const SNOW_FALL_PX_S = 140;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

export type ParticleKind = 'SNOW' | 'FIREFLY' | null;

export function particleKind(lighting: LightingId): ParticleKind {
  if (lighting === 'BLIZZARD') return 'SNOW';
  if (lighting === 'MAGIC_FOG') return 'FIREFLY';
  return null;
}

export class WeatherParticles {
  readonly kind: ParticleKind;
  readonly particles: Particle[] = [];
  private readonly rng: Rng;

  constructor(
    lighting: LightingId,
    private readonly width: number,
    private readonly height: number,
    seed = 0x5a0e,
    private readonly max = MAX_PARTICLES,
  ) {
    this.kind = particleKind(lighting);
    this.rng = mulberry32(seed);
    if (this.kind) {
      const n = Math.min(this.max, this.kind === 'SNOW' ? 260 : 60);
      for (let k = 0; k < n; k++) this.particles.push(this.spawn(true));
    }
  }

  private spawn(anywhere: boolean): Particle {
    const r = this.rng;
    return {
      x: r.range(0, this.width),
      y: anywhere ? r.range(0, this.height) : -4,
      vx: 0,
      vy: this.kind === 'SNOW' ? SNOW_FALL_PX_S * r.range(0.6, 1.2) : 0,
      size: this.kind === 'SNOW' ? r.range(1, 3) : r.range(2, 3.5),
      phase: r.range(0, Math.PI * 2),
    };
  }

  /** Avança `dtS`; `windCrossMs` empurra a neve para o lado (positivo = direita). */
  update(dtS: number, windCrossMs: number, tS: number): void {
    if (!this.kind) return;
    for (let k = 0; k < this.particles.length; k++) {
      const p = this.particles[k] as Particle;
      if (this.kind === 'SNOW') {
        // Queda diagonal: a deriva acompanha o vento.
        p.vx = windCrossMs * WIND_PX_PER_MS;
        p.x += p.vx * dtS;
        p.y += p.vy * dtS;
        if (p.y > this.height || p.x < -8 || p.x > this.width + 8) {
          const fresh = this.spawn(false);
          // Reentra pelo lado de onde o vento sopra, para a tela não esvaziar.
          if (p.x < -8 || p.x > this.width + 8) fresh.x = p.x < 0 ? this.width : 0;
          this.particles[k] = fresh;
        }
      } else {
        // Vaga-lume: passeio lento e brilho pulsante.
        p.x += Math.sin(tS * 0.7 + p.phase) * 14 * dtS;
        p.y += Math.cos(tS * 0.5 + p.phase * 1.7) * 10 * dtS;
        p.x = (p.x + this.width) % this.width;
        p.y = (p.y + this.height) % this.height;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, tS: number): void {
    if (!this.kind) return;
    for (const p of this.particles) {
      if (this.kind === 'SNOW') {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(tS * 1.5 + p.phase));
        ctx.fillStyle = `rgba(190, 242, 100, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
