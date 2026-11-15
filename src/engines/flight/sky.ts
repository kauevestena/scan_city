/** Céu do voo (survey-flight §5.5): gradiente da paleta; na hora dourada, sol no horizonte. */
import { hash2 } from '@/lib/rng';
import type { LightingId, Rgb } from '@/types';
import { COLORS, withAlpha } from '@/ui/tokens';
import type { BiomePalette } from '@/world/terrain/TerrainSampler';

const rgb = (c: Rgb) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const GOLDEN: Rgb = [251, 146, 60];

export function drawSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  palette: BiomePalette,
  lighting: LightingId,
): void {
  const horizon = lighting === 'GOLDEN_HOUR' ? GOLDEN : palette.skyHorizon;
  const grad = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonY));
  grad.addColorStop(0, rgb(palette.skyTop));
  grad.addColorStop(1, rgb(horizon));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, Math.max(0, horizonY) + 1);
  // Abaixo do horizonte, a névoa cobre o que o terreno não alcança.
  ctx.fillStyle = rgb(palette.fog);
  ctx.fillRect(0, horizonY, width, height - horizonY);
  if (lighting === 'GOLDEN_HOUR') {
    ctx.fillStyle = 'rgba(254, 215, 170, 0.9)';
    ctx.beginPath();
    ctx.arc(width * 0.72, horizonY - 6, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Partículas flutuantes da fenda e a semente do desenho. */
export const RIFT_PARTICLES = 48;
const RIFT_SEED = 0x7e57;

/**
 * Céu das fendas (contracts-rifts §1): um véu em gradiente violeta → ciano sobre o céu do bioma,
 * que respira devagar. Vale para qualquer fenda, qualquer que seja a paleta do bioma.
 */
export function drawRiftSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizonY: number,
  timeS: number,
  calm = false,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonY));
  const breath = calm ? 0 : 0.05 * Math.sin(timeS * 0.8);
  grad.addColorStop(0, withAlpha(COLORS.rift, 0.6 + breath));
  grad.addColorStop(1, withAlpha(COLORS.radar, 0.45 - breath));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, Math.max(0, horizonY) + 1);
}

/** Partículas luminosas subindo pela tela inteira, em violeta e ciano alternados. */
export function drawRiftParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeS: number,
): void {
  for (let i = 0; i < RIFT_PARTICLES; i++) {
    const speed = 8 + hash2(i, 2, RIFT_SEED) * 16;
    const x = hash2(i, 0, RIFT_SEED) * width + 10 * Math.sin(timeS * 0.7 + i);
    const y = height - ((hash2(i, 1, RIFT_SEED) * height + timeS * speed) % height);
    ctx.fillStyle = withAlpha(i % 2 === 0 ? COLORS.rift : COLORS.radar, 0.55);
    ctx.fillRect(x, y, 2, 2);
  }
}
