/**
 * A rajada vista na cena (survey-flight §5.13, ADR-034): o aviso não é escrito no HUD, é uma
 * **frente de vento** que varre a paisagem do lado de onde a rajada vem e chega à aeronave no
 * instante em que o empurrão começa. É uma cortina translúcida paralela à linha, com riscos de
 * vento apontando para onde ela empurra; quando chega, a aeronave leva um tranco (sem o
 * contragolpe) ou corta o vento (com ele). As listas são puras (testáveis sem pixels); o
 * desenho só as executa, em poucas chamadas.
 */
import { GUST_WARN_S } from '@/domain/gusts';
import { clamp } from '@/lib/math';
import { projectAbs, type FlightCamera, type Projected } from './projection';

/** Distância lateral (m) de onde a frente parte, no começo do aviso. */
export const GUST_FRONT_START_M = 80;
/** A cortina vai deste Z (perto da câmera) até `GUST_FRONT_FAR_M` à frente. */
export const GUST_FRONT_NEAR_M = -22;
export const GUST_FRONT_FAR_M = 360;
/** Altura da cortina abaixo e acima da aeronave (m). */
export const GUST_FRONT_BELOW_M = 45;
export const GUST_FRONT_ABOVE_M = 28;
/** Riscos de vento junto da frente. */
export const GUST_FRONT_STREAKS = 34;
/**
 * Rajada vertical (ADR-035): a frente é uma lâmina horizontal que desce do céu (a que empurra
 * para baixo) ou sobe do chão (a que empurra para cima) e chega à altitude da aeronave no
 * instante do empurrão. Parte deste tanto acima ou abaixo, e cobre esta meia largura em X.
 */
export const VERTICAL_FRONT_START_M = 55;
export const VERTICAL_FRONT_HALF_WIDTH_M = 70;
/** Duração (tempo real) do tranco ou do corte na chegada. */
export const GUST_IMPACT_S = 0.4;
/** Tranco lateral máximo da tela quando a rajada bate sem contragolpe (px). */
export const GUST_JOLT_PX = 7;

export interface GustFrontInput {
  /** Rajada avisada: lado para onde empurra e o tempo (simulado) até ela chegar. */
  side: -1 | 1;
  inS: number;
  /** X da aeronave (frame do run) e a altitude dela. */
  aircraftX: number;
  aircraftAlt: number;
  cam: FlightCamera;
  /** Relógio (s) para a animação dos riscos. */
  timeS: number;
}

export interface GustFrontDraw {
  /** Avanço do aviso, 0 (frente aparecendo) a 1 (chegando). */
  progress: number;
  /** X da frente (frame do run). */
  frontX: number;
  /** A cortina projetada (4 cantos: perto-baixo, perto-cima, longe-cima, longe-baixo). */
  sheet: [Projected, Projected, Projected, Projected] | null;
  sheetAlpha: number;
  /** Riscos de vento: segmentos na tela (x0, y0, x1, y1). */
  streaks: number[];
  streakAlpha: number;
}

/** Fração pseudoaleatória fixa por índice (sem sorteio a cada quadro). */
const frac = (k: number, a: number, b: number) => Math.abs(Math.sin(k * a) * b) % 1;

/** X da frente `inS` antes da chegada: parte de 80 m do lado de onde vem e anda em linha reta. */
export function gustFrontX(aircraftX: number, side: -1 | 1, inS: number): number {
  const p = clamp(1 - inS / GUST_WARN_S, 0, 1);
  return aircraftX - side * GUST_FRONT_START_M * (1 - p);
}

/** A frente de vento de uma rajada avisada; `null` fora do aviso. */
export function buildGustFront(i: GustFrontInput): GustFrontDraw | null {
  if (!(i.inS > 0) || i.inS > GUST_WARN_S) return null;
  const progress = clamp(1 - i.inS / GUST_WARN_S, 0, 1);
  const frontX = gustFrontX(i.aircraftX, i.side, i.inS);
  const lo = i.aircraftAlt - GUST_FRONT_BELOW_M;
  const hi = i.aircraftAlt + GUST_FRONT_ABOVE_M;
  const a = projectAbs(frontX, lo, GUST_FRONT_NEAR_M, i.cam);
  const b = projectAbs(frontX, hi, GUST_FRONT_NEAR_M, i.cam);
  const c = projectAbs(frontX, hi, GUST_FRONT_FAR_M, i.cam);
  const d = projectAbs(frontX, lo, GUST_FRONT_FAR_M, i.cam);
  const sheet = a && b && c && d ? ([a, b, c, d] as GustFrontDraw['sheet']) : null;
  // Riscos: saem da frente para o lado do empurrão, em Z e alturas fixas por índice, e correm
  // para o lado do empurrão (o vento passando).
  const streaks: number[] = [];
  for (let k = 0; k < GUST_FRONT_STREAKS; k++) {
    const h1 = frac(k + 1, 12.9898, 43758.5453);
    const h2 = frac(k + 1, 78.233, 12543.873);
    const h3 = frac(k + 1, 39.425, 24634.633);
    const Z = GUST_FRONT_NEAR_M + 10 + (GUST_FRONT_FAR_M * 0.7 - 10) * h1 * h1;
    const alt = lo + (hi - lo) * h2;
    const run = ((i.timeS * (1.2 + h3) + h3) % 1) * 12;
    const x0 = frontX + i.side * (run - 3);
    const x1 = x0 + i.side * (6 + 8 * h2);
    // Um pouco inclinados (o ar rodopiando), uns subindo, outros descendo.
    const tilt = (h3 - 0.5) * 3;
    const p0 = projectAbs(x0, alt, Z, i.cam);
    const p1 = projectAbs(x1, alt + tilt, Z, i.cam);
    if (p0 && p1) streaks.push(p0.x, p0.y, p1.x, p1.y);
  }
  return {
    progress,
    frontX,
    sheet,
    sheetAlpha: 0.1 + 0.2 * progress,
    streaks,
    streakAlpha: 0.35 + 0.5 * progress,
  };
}

/** Altitude da lâmina da rajada vertical `inS` antes da chegada: parte de 55 m do lado de onde vem. */
export function verticalFrontAlt(aircraftAlt: number, dir: -1 | 1, inS: number): number {
  const p = clamp(1 - inS / GUST_WARN_S, 0, 1);
  return aircraftAlt - dir * VERTICAL_FRONT_START_M * (1 - p);
}

/**
 * A frente de uma rajada vertical (`side` = +1 sobe, −1 desce): a lâmina horizontal na altitude
 * da frente, de perto da câmera até longe, e os riscos verticais apontando para onde ela empurra.
 * `null` fora do aviso.
 */
export function buildVerticalGustFront(i: GustFrontInput): GustFrontDraw | null {
  if (!(i.inS > 0) || i.inS > GUST_WARN_S) return null;
  const progress = clamp(1 - i.inS / GUST_WARN_S, 0, 1);
  const alt = verticalFrontAlt(i.aircraftAlt, i.side, i.inS);
  const x0 = i.aircraftX - VERTICAL_FRONT_HALF_WIDTH_M;
  const x1 = i.aircraftX + VERTICAL_FRONT_HALF_WIDTH_M;
  // Perto-esquerda, perto-direita, longe-direita, longe-esquerda.
  const a = projectAbs(x0, alt, GUST_FRONT_NEAR_M, i.cam);
  const b = projectAbs(x1, alt, GUST_FRONT_NEAR_M, i.cam);
  const c = projectAbs(x1, alt, GUST_FRONT_FAR_M, i.cam);
  const d = projectAbs(x0, alt, GUST_FRONT_FAR_M, i.cam);
  const sheet = a && b && c && d ? ([a, b, c, d] as GustFrontDraw['sheet']) : null;
  const streaks: number[] = [];
  for (let k = 0; k < GUST_FRONT_STREAKS; k++) {
    const h1 = frac(k + 1, 12.9898, 43758.5453);
    const h2 = frac(k + 1, 78.233, 12543.873);
    const h3 = frac(k + 1, 39.425, 24634.633);
    const Z = GUST_FRONT_NEAR_M + 10 + (GUST_FRONT_FAR_M * 0.7 - 10) * h1 * h1;
    const X = x0 + (x1 - x0) * h2;
    const run = ((i.timeS * (1.2 + h3) + h3) % 1) * 10;
    // Os riscos saem da lâmina e correm para onde ela empurra (o ar caindo ou subindo).
    const y0 = alt + i.side * (run - 3);
    const y1 = y0 + i.side * (5 + 7 * h3);
    const p0 = projectAbs(X, y0, Z, i.cam);
    const p1 = projectAbs(X + (h2 - 0.5) * 2, y1, Z, i.cam);
    if (p0 && p1) streaks.push(p0.x, p0.y, p1.x, p1.y);
  }
  return {
    progress,
    frontX: i.aircraftX,
    sheet,
    sheetAlpha: 0.08 + 0.18 * progress,
    streaks,
    streakAlpha: 0.35 + 0.5 * progress,
  };
}

/** Executa a frente: a cortina, as bordas e os riscos (quatro chamadas de desenho). */
export function drawGustFront(ctx: CanvasRenderingContext2D, f: GustFrontDraw): void {
  ctx.save();
  if (f.sheet) {
    const [a, b, c, d] = f.sheet;
    ctx.fillStyle = `rgba(226, 232, 240, ${f.sheetAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    // As bordas de cima e de baixo e a quina de perto: a frente se lê mesmo sobre o céu claro.
    ctx.strokeStyle = `rgba(241, 245, 249, ${(0.2 + 0.5 * f.progress).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }
  if (f.streaks.length > 0) {
    ctx.strokeStyle = `rgba(248, 250, 252, ${f.streakAlpha.toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < f.streaks.length; k += 4) {
      ctx.moveTo(f.streaks[k] as number, f.streaks[k + 1] as number);
      ctx.lineTo(f.streaks[k + 2] as number, f.streaks[k + 3] as number);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Tranco lateral da tela na chegada de uma rajada sem contragolpe: empurra para o lado da
 * rajada e volta em `GUST_IMPACT_S` (tempo real). Nada com `reduceFlashes` ou com a rajada
 * cortada.
 */
export function gustJoltPx(
  impact: { side: -1 | 1; cut: boolean; atS: number } | null,
  nowS: number,
  reduceFlashes: boolean,
): number {
  if (!impact || impact.cut || reduceFlashes) return 0;
  const k = (nowS - impact.atS) / GUST_IMPACT_S;
  if (k < 0 || k >= 1) return 0;
  return impact.side * GUST_JOLT_PX * Math.sin(k * Math.PI) * (1 - k);
}

/**
 * O corte da rajada no tempo: um arco claro do lado de onde ela veio, em volta da aeronave,
 * que abre e some (em cima, se ela descia; embaixo, se subia). Com `reduceFlashes`, não abre:
 * só some.
 */
export function drawGustCut(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: -1 | 1,
  ageS: number,
  reduceFlashes: boolean,
  axis: 'LATERAL' | 'VERTICAL' = 'LATERAL',
): void {
  const k = ageS / GUST_IMPACT_S;
  if (k < 0 || k >= 1) return;
  const r = reduceFlashes ? 40 : 26 + 46 * k;
  // O arco fica do lado de onde o vento veio (o oposto do empurrão). Na tela, y cresce para baixo:
  // a rajada que sobe veio de baixo (π/2) e a que desce, de cima (−π/2).
  const mid =
    axis === 'VERTICAL' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? Math.PI : 0;
  ctx.save();
  ctx.strokeStyle = `rgba(110, 231, 183, ${(0.85 * (1 - k)).toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, mid - 0.9, mid + 0.9);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, mid - 0.6, mid + 0.6);
  ctx.stroke();
  ctx.restore();
}
