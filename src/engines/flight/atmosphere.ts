/**
 * Atmosfera épica do voo (survey-flight §5.5, ADR-034): céu em camadas com o sol, os raios e o
 * mar de nuvens no horizonte; a névoa que funde o relevo distante no horizonte; as nuvens baixas
 * que passam por cima da aeronave; os riscos de velocidade; a vinheta; e a inclinação da câmera
 * nas curvas.
 *
 * Tudo foi pensado para o raster sem GPU: o céu inteiro é pintado **uma vez** num bitmap (que só
 * muda com o tamanho da tela, a iluminação e o rumo da linha) e copiado a cada quadro; as nuvens
 * baixas são o mesmo sprite reaproveitado; riscos e trilhas saem num traço por nível de
 * transparência.
 */
import { hash2 } from '@/lib/rng';
import { clamp } from '@/lib/math';
import type { LightingId, Rgb } from '@/types';
import type { BiomePalette } from '@/world/terrain/TerrainSampler';
import { HORIZON_TAKEOFF, projectAbs, type FlightCamera, type Quality } from './projection';

const rgb = (c: Rgb) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const rgba = (c: Rgb, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a.toFixed(3)})`;
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * k),
  Math.round(a[1] + (b[1] - a[1]) * k),
  Math.round(a[2] + (b[2] - a[2]) * k),
];
const WHITE: Rgb = [255, 255, 255];
const NIGHT: Rgb = [15, 23, 42];
const GOLDEN: Rgb = [251, 146, 60];
const SUN_WARM: Rgb = [255, 214, 153];
const SUN_HIGH: Rgb = [255, 246, 220];

/** Inclinação máxima da câmera nas curvas (rad). */
export const ROLL_MAX_RAD = (5 * Math.PI) / 180;
/** Rapidez com que a câmera segue a inclinação pedida (1/s, tempo real). */
export const ROLL_RATE = 5;
/** Folga do desenho além da borda da tela (fração da largura), para a câmera inclinada. */
export const OVERSCAN = 0.06;

/** Folga, em px, que a tela de `width` px precisa em cada lado para inclinar sem mostrar canto. */
export function overscanPx(width: number): number {
  return Math.ceil(OVERSCAN * width);
}

/**
 * Inclinação pedida para a câmera: acompanha a velocidade lateral da aeronave (para onde ela
 * escorrega, a câmera deita), até `ROLL_MAX_RAD`. Zero com `reduceFlashes`.
 */
export function rollTarget(
  lateralMs: number,
  lateralRefMs: number,
  reduceFlashes: boolean,
): number {
  if (reduceFlashes) return 0;
  return -clamp(lateralMs / Math.max(0.1, lateralRefMs), -1, 1) * ROLL_MAX_RAD;
}

/** Um passo do amortecimento da inclinação, em tempo real. */
export function stepRoll(current: number, target: number, dtRealS: number): number {
  const k = 1 - Math.exp(-ROLL_RATE * Math.max(0, dtRealS));
  return current + (target - current) * k;
}

// --- céu ---------------------------------------------------------------------

export interface SkyInput {
  width: number;
  height: number;
  horizonY: number;
  focalPx: number;
  palette: BiomePalette;
  lighting: LightingId;
  /** Direção do sol no frame do run (x à direita, z à frente, up para cima); `null` difusa. */
  sun: { x: number; z: number; up: number } | null;
  quality: Quality;
  /** px do buffer por px lógico: o bitmap do céu sai na resolução do canvas. */
  scale?: number;
}

/** Onde o sol cai na tela (em relação ao horizonte, que fica em y = 0); `null` atrás da câmera. */
export function sunOnScreen(
  sun: SkyInput['sun'],
  width: number,
  focalPx: number,
): { x: number; y: number } | null {
  if (!sun || sun.z <= 0.05) return null;
  return { x: width / 2 + (sun.x / sun.z) * focalPx, y: -(sun.up / sun.z) * focalPx };
}

/** Nuvens do mar de nuvens no horizonte, por qualidade. */
export const CLOUD_BANK: Readonly<Record<Quality, number>> = { HIGH: 34, MEDIUM: 26, LOW: 18 };
/** Nuvens altas, por qualidade. */
export const HIGH_CLOUDS: Readonly<Record<Quality, number>> = { HIGH: 7, MEDIUM: 5, LOW: 3 };
const SKY_SEED = 0x5c1e;

type Canvas2D = HTMLCanvasElement;

function makeCanvas(w: number, h: number): Canvas2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * O céu do voo, pintado uma vez num bitmap e copiado a cada quadro. O bitmap tem folga em volta
 * (a câmera inclina) e altura para o horizonte descer até o da decolagem: a animação da
 * decolagem só desloca a cópia, sem repintar.
 */
export class SkyPainter {
  private cache: Canvas2D | null = null;
  private key = '';
  /** Onde o horizonte fica no bitmap, e a folga. */
  private horizonAt = 0;
  private margin = 0;
  private cacheScale = 1;
  /** Quantas vezes o bitmap foi pintado (testes: a cópia não repinta). */
  repaints = 0;

  /** Copia o céu (pintando o bitmap se a tela, a luz ou o rumo mudaram). */
  paint(ctx: CanvasRenderingContext2D, s: SkyInput): void {
    const sunKey = s.sun ? `${s.sun.x.toFixed(2)},${s.sun.z.toFixed(2)}` : 'none';
    const scale = s.scale ?? 1;
    const key = `${s.width}x${s.height}@${scale.toFixed(2)}|${s.lighting}|${sunKey}|${s.quality}|${rgb(s.palette.skyTop)}|${rgb(s.palette.fog)}`;
    if (key !== this.key || !this.cache) {
      this.key = key;
      this.render(s);
    }
    const dy = s.horizonY - this.horizonAt;
    if (this.cache) {
      const k = this.cacheScale;
      const t = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
      if (t && t.b === 0 && t.c === 0 && Math.abs(t.a - k) < 1e-6 && Math.abs(t.d - k) < 1e-6) {
        // Sem inclinação: cópia em pixels inteiros do buffer, sem reamostrar (o caminho rápido do
        // raster sem GPU; um deslocamento fracionário reamostraria a tela toda).
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.cache, Math.round(t.e - this.margin * k), Math.round(t.f + dy * k));
        ctx.restore();
      } else {
        ctx.drawImage(this.cache, -this.margin, dy, this.cache.width / k, this.cache.height / k);
      }
    } else {
      // Sem `document` (testes de motor puro): o gradiente direto, sem bitmap.
      paintSky(
        ctx,
        s,
        s.horizonY,
        -overscanPx(s.width),
        s.width + 2 * overscanPx(s.width),
        s.height,
      );
    }
  }

  private render(s: SkyInput): void {
    const m = overscanPx(s.width);
    // O horizonte mais baixo é o da decolagem; o bitmap cobre da folga de cima à de baixo nele.
    this.horizonAt = m + HORIZON_TAKEOFF * s.height;
    this.margin = m;
    const w = s.width + 2 * m;
    const h = this.horizonAt + (1 - 0.3) * s.height + m;
    const k = clamp(s.scale ?? 1, 0.5, 3);
    this.cacheScale = k;
    const c = makeCanvas(w * k, h * k);
    this.cache = c;
    const g = c?.getContext('2d') ?? null;
    if (!c || !g) {
      this.cache = null;
      return;
    }
    this.repaints++;
    g.scale(k, k);
    g.translate(m, 0);
    paintSky(g, s, this.horizonAt, -m, w, h);
  }
}

/**
 * Pinta o céu com o horizonte em `horizonY`, na faixa `[x0, x0 + w]` × `[0, h]`: o gradiente em
 * camadas, o brilho e os raios do sol, as nuvens altas e o mar de nuvens no horizonte. Abaixo do
 * horizonte, a névoa (o terreno cobre o resto).
 */
export function paintSky(
  ctx: CanvasRenderingContext2D,
  s: SkyInput,
  horizonY: number,
  x0: number,
  w: number,
  h: number,
): void {
  const pal = s.palette;
  const golden = s.lighting === 'GOLDEN_HOUR';
  const diffuse = s.lighting !== 'SUN_HIGH' && !golden;
  const horizon = golden ? mix(pal.skyHorizon, GOLDEN, 0.75) : pal.skyHorizon;
  const zenith = mix(pal.skyTop, NIGHT, golden ? 0.45 : 0.3);
  const top = Math.max(1, horizonY);
  const grad = ctx.createLinearGradient(0, 0, 0, top);
  grad.addColorStop(0, rgb(zenith));
  grad.addColorStop(0.55, rgb(golden ? mix(pal.skyTop, GOLDEN, 0.25) : pal.skyTop));
  grad.addColorStop(0.88, rgb(mix(horizon, pal.skyTop, 0.25)));
  grad.addColorStop(1, rgb(mix(horizon, WHITE, diffuse ? 0.1 : 0.25)));
  ctx.fillStyle = grad;
  ctx.fillRect(x0, 0, w, top + 1);
  ctx.fillStyle = rgb(pal.fog);
  ctx.fillRect(x0, horizonY, w, h - horizonY);

  // O sol: brilho largo, raios descendo e o disco (quando está à frente e acima do horizonte).
  const sunColor = golden ? SUN_WARM : SUN_HIGH;
  const sp = sunOnScreen(s.sun, s.width, s.focalPx);
  if (sp && !diffuse) {
    const sx = sp.x;
    const sy = horizonY + sp.y;
    const r = s.width * (golden ? 0.55 : 0.7);
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    glow.addColorStop(0, rgba(sunColor, golden ? 0.75 : 0.55));
    glow.addColorStop(0.25, rgba(sunColor, golden ? 0.3 : 0.18));
    glow.addColorStop(1, rgba(sunColor, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x0, 0, w, Math.max(1, horizonY + 0.25 * s.height));
    // Raios: cunhas finas e translúcidas que descem do sol.
    const rays = s.quality === 'LOW' ? 4 : 7;
    ctx.fillStyle = rgba(sunColor, golden ? 0.07 : 0.05);
    ctx.beginPath();
    for (let k = 0; k < rays; k++) {
      const a = Math.PI / 2 + (k - (rays - 1) / 2) * 0.22 + (hash2(k, 7, SKY_SEED) - 0.5) * 0.12;
      const len = s.height * (1.1 + hash2(k, 9, SKY_SEED));
      const half = 0.025 + 0.035 * hash2(k, 11, SKY_SEED);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - half) * len, sy + Math.sin(a - half) * len);
      ctx.lineTo(sx + Math.cos(a + half) * len, sy + Math.sin(a + half) * len);
      ctx.closePath();
    }
    ctx.fill();
    if (sy > -40 && sy < horizonY + 10) {
      ctx.fillStyle = rgba(golden ? [255, 237, 213] : WHITE, 0.95);
      ctx.beginPath();
      ctx.arc(sx, sy, golden ? 20 : 14, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (s.sun && !diffuse) {
    // Sol atrás da câmera: o horizonte à frente pega a luz rasante.
    const band = ctx.createLinearGradient(0, horizonY - 0.2 * s.height, 0, horizonY);
    band.addColorStop(0, rgba(sunColor, 0));
    band.addColorStop(1, rgba(sunColor, golden ? 0.35 : 0.18));
    ctx.fillStyle = band;
    ctx.fillRect(x0, horizonY - 0.2 * s.height, w, 0.2 * s.height + 1);
  }

  // Nuvens altas: aglomerados de elipses claras, com a base sombreada.
  const lit = golden ? mix(SUN_WARM, WHITE, 0.4) : mix(pal.skyHorizon, WHITE, 0.6);
  const shade = mix(horizon, zenith, golden ? 0.45 : 0.35);
  const high = HIGH_CLOUDS[s.quality];
  for (let k = 0; k < high; k++) {
    const cx = x0 + w * hash2(k, 1, SKY_SEED);
    const cy = horizonY * (0.12 + 0.55 * hash2(k, 2, SKY_SEED));
    const cw = s.width * (0.12 + 0.16 * hash2(k, 3, SKY_SEED));
    cloudPuff(ctx, cx, cy, cw, cw * 0.18, lit, shade, 0.55, k + 100);
  }
  // O mar de nuvens no horizonte: uma fileira de cúmulos que esconde a borda do relevo.
  const bank = CLOUD_BANK[s.quality];
  for (let k = 0; k < bank; k++) {
    const cx = x0 + (w * (k + hash2(k, 4, SKY_SEED))) / bank;
    const cw = (w / bank) * (1.6 + 1.4 * hash2(k, 5, SKY_SEED));
    const ch = cw * (0.22 + 0.18 * hash2(k, 6, SKY_SEED));
    cloudPuff(ctx, cx, horizonY - ch * 0.35, cw, ch, lit, shade, 0.85, k);
  }
  // A base do mar de nuvens se funde na névoa.
  const foot = ctx.createLinearGradient(
    0,
    horizonY - 0.03 * s.height,
    0,
    horizonY + 0.02 * s.height,
  );
  foot.addColorStop(0, rgba(pal.fog, 0));
  foot.addColorStop(1, rgba(pal.fog, 1));
  ctx.fillStyle = foot;
  ctx.fillRect(x0, horizonY - 0.03 * s.height, w, 0.05 * s.height + 1);
}

/** Um cúmulo: lóbulos claros por cima, a base mais escura por baixo. */
function cloudPuff(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  lit: Rgb,
  shade: Rgb,
  alpha: number,
  seed: number,
): void {
  ctx.fillStyle = rgba(shade, alpha * 0.8);
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.25, w * 0.5, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(lit, alpha);
  ctx.beginPath();
  const lobes = 4;
  for (let i = 0; i < lobes; i++) {
    const t = (i + 0.5) / lobes - 0.5;
    const lw = w * (0.22 + 0.12 * hash2(seed, i, SKY_SEED));
    const lh = h * (0.6 + 0.5 * hash2(seed, i + 9, SKY_SEED));
    const lx = cx + t * w * 0.8;
    const ly = cy - lh * 0.25 * (1 - Math.abs(t));
    ctx.moveTo(lx + lw, ly);
    ctx.ellipse(lx, ly, lw, lh, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * A névoa do horizonte (perspectiva aérea): depois do relevo, uma faixa da cor da névoa que
 * some para baixo, fundindo o terreno distante no mar de nuvens.
 */
export function drawHorizonHaze(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  fog: Rgb,
): void {
  const m = overscanPx(width);
  const band = 0.14 * height;
  const g = ctx.createLinearGradient(0, horizonY, 0, horizonY + band);
  g.addColorStop(0, rgba(fog, 0.85));
  g.addColorStop(1, rgba(fog, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-m, horizonY - 2, width + 2 * m, band + 2);
}

// --- riscos de velocidade -----------------------------------------------------

/** Riscos de velocidade no máximo, por qualidade. */
export const SPEED_STREAKS: Readonly<Record<Quality, number>> = { HIGH: 30, MEDIUM: 22, LOW: 14 };
/** Velocidade visual (m/s de mundo por segundo real) em que os riscos começam e saturam. */
export const SPEED_STREAK_FROM_MS = 14;
export const SPEED_STREAK_FULL_MS = 60;

/** Intensidade dos riscos (0–1) pela velocidade que o jogador vê: solo × escala do tempo. */
export function speedIntensity(groundSpeedMs: number, timeScale: number): number {
  const v = groundSpeedMs * timeScale;
  return clamp((v - SPEED_STREAK_FROM_MS) / (SPEED_STREAK_FULL_MS - SPEED_STREAK_FROM_MS), 0, 1);
}

/**
 * Riscos de velocidade: traços que saem do ponto de fuga para as bordas, só na coroa de fora
 * (o centro, onde estão a aeronave e os portais, fica limpo). Segmentos (x0, y0, x1, y1).
 */
export function speedStreaks(
  width: number,
  height: number,
  horizonY: number,
  intensity: number,
  timeS: number,
  quality: Quality,
): number[] {
  const out: number[] = [];
  if (intensity <= 0) return out;
  const n = Math.round(SPEED_STREAKS[quality] * (0.4 + 0.6 * intensity));
  const cx = width / 2;
  const cy = horizonY;
  const reach = Math.hypot(width / 2, height - horizonY) * 1.05;
  for (let k = 0; k < n; k++) {
    const a = 2 * Math.PI * hash2(k, 1, 0x57ea);
    // Mais riscos para os lados e para baixo (o chão passando), poucos no céu.
    const sinA = Math.sin(a);
    if (sinA < -0.35 && hash2(k, 5, 0x57ea) < 0.7) continue;
    const speed = 0.9 + 1.2 * hash2(k, 2, 0x57ea);
    const t = (timeS * speed * (0.6 + 1.4 * intensity) + hash2(k, 3, 0x57ea)) % 1;
    const r0 = reach * (0.45 + 0.55 * t);
    const len = reach * (0.05 + 0.13 * intensity) * (0.5 + t);
    const ca = Math.cos(a);
    out.push(cx + ca * r0, cy + sinA * r0, cx + ca * (r0 + len), cy + sinA * (r0 + len));
  }
  return out;
}

export function drawSpeedStreaks(
  ctx: CanvasRenderingContext2D,
  segs: readonly number[],
  intensity: number,
): void {
  if (segs.length === 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(241, 245, 249, ${(0.08 + 0.22 * intensity).toFixed(3)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 0; k < segs.length; k += 4) {
    ctx.moveTo(segs[k] as number, segs[k + 1] as number);
    ctx.lineTo(segs[k + 2] as number, segs[k + 3] as number);
  }
  ctx.stroke();
  ctx.restore();
}

// --- nuvens baixas --------------------------------------------------------------

/** Espaçamento das nuvens baixas ao longo da linha (m) e quantas por fileira, por qualidade. */
export const WISP_SPACING_M = 140;
export const WISPS_PER_ROW: Readonly<Record<Quality, number>> = { HIGH: 2, MEDIUM: 2, LOW: 1 };
/** Até onde (à frente) as nuvens baixas aparecem. */
export const WISP_VIEW_M = 520;
/** Mais perto que isto (profundidade da câmera), a nuvem já sumiu. */
export const WISP_NEAR_DEPTH_M = 30;

export interface Wisp {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
}

/**
 * Nuvens baixas: farrapos fixos no mundo (numa grade ao longo da linha), acima da aeronave e
 * para os lados, que crescem e passam por cima dela. Some de perto (para não tapar a tela) e
 * de longe (a névoa). Determinístico pela posição na linha.
 */
export function buildWisps(
  s: number,
  aircraftAlt: number,
  cam: FlightCamera,
  quality: Quality,
): Wisp[] {
  const out: Wisp[] = [];
  const per = WISPS_PER_ROW[quality];
  const first = Math.floor((s - 20) / WISP_SPACING_M);
  const last = Math.floor((s + WISP_VIEW_M) / WISP_SPACING_M);
  for (let row = last; row >= first; row--) {
    for (let k = 0; k < per; k++) {
      const h1 = hash2(row, k, 0x3157);
      const h2 = hash2(row, k + 7, 0x3157);
      const h3 = hash2(row, k + 13, 0x3157);
      const Z = row * WISP_SPACING_M + h1 * WISP_SPACING_M - s;
      const depth = Z + 30;
      if (depth < WISP_NEAR_DEPTH_M || Z > WISP_VIEW_M) continue;
      const side = k % 2 === 0 ? -1 : 1;
      const X = cam.camX + side * (14 + 60 * h2);
      const alt = aircraftAlt + 18 + 30 * h3;
      const widthM = 40 + 50 * h2;
      const p = projectAbs(X, alt, Z, cam);
      if (!p) continue;
      const near = clamp((depth - WISP_NEAR_DEPTH_M) / 50, 0, 1);
      const far = clamp(1 - Z / WISP_VIEW_M, 0, 1);
      const alpha = 0.5 * near * far;
      if (alpha < 0.02) continue;
      const w = widthM * p.scale;
      out.push({ x: p.x, y: p.y, w, h: w * 0.32, alpha });
    }
  }
  return out;
}

let wispSprite: Canvas2D | null | undefined;

/** O sprite de um farrapo (pintado uma vez): manchas brancas de borda macia. */
function wispImage(): Canvas2D | null {
  if (wispSprite !== undefined) return wispSprite;
  const c = makeCanvas(128, 48);
  const g = c?.getContext('2d') ?? null;
  if (!c || !g) {
    wispSprite = null;
    return null;
  }
  for (const [x, y, r, a] of [
    [44, 26, 26, 0.7],
    [70, 22, 30, 0.8],
    [92, 28, 22, 0.6],
    [60, 32, 34, 0.45],
  ] as const) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(248, 250, 252, ${a})`);
    grad.addColorStop(1, 'rgba(248, 250, 252, 0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  wispSprite = c;
  return c;
}

export function drawWisps(ctx: CanvasRenderingContext2D, wisps: readonly Wisp[]): void {
  const img = wispImage();
  if (!img || wisps.length === 0) return;
  ctx.save();
  for (const w of wisps) {
    ctx.globalAlpha = w.alpha;
    ctx.drawImage(img, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);
  }
  ctx.restore();
}

// --- vinheta ----------------------------------------------------------------------

/**
 * Vinheta: as bordas de cima e de baixo escurecem um pouco (o olhar vai para o centro). Duas
 * faixas em gradiente, fora da inclinação da câmera.
 */
export function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const band = 0.16 * height;
  const top = ctx.createLinearGradient(0, 0, 0, band);
  top.addColorStop(0, 'rgba(2, 6, 23, 0.42)');
  top.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, width, band);
  const bottom = ctx.createLinearGradient(0, height - band, 0, height);
  bottom.addColorStop(0, 'rgba(2, 6, 23, 0)');
  bottom.addColorStop(1, 'rgba(2, 6, 23, 0.38)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, height - band, width, band);
}
