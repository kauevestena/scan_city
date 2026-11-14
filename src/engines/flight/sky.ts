/** Céu do voo (survey-flight §5.5): gradiente da paleta; na hora dourada, sol no horizonte. */
import type { LightingId, Rgb } from '@/types';
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
