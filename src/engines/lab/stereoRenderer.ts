/**
 * Diagrama de Estereoscopia & Paralaxe (infographic-lab §5.2, REQ-LAB-002): duas câmeras (C1 e C2)
 * separadas por B na altura H, um prédio de altura h entre elas, raios de cada câmera até o topo
 * (âmbar) e a base (ciano) e, no alto, os dois planos-imagem ampliados com as posições dos pontos
 * e as cotas b (base fotográfica) e Δp (paralaxe diferencial).
 *
 * Só desenha: b e Δp (em mm) e os rótulos chegam calculados pelo domínio; a interpolação de 150 ms
 * do prédio e dos raios fica por conta de quem chama (`approach`).
 */
import { COLORS, withAlpha } from '@/ui/tokens';
import { dimension, dot, line, text } from './draw';

export interface StereoLabels {
  base: string;
  height: string;
  object: string;
  photoBase: string;
  parallax: string;
  photo1: string;
  photo2: string;
  overlay: string;
  top: string;
  ground: string;
}

export interface StereoView {
  /** Área de desenho, em px CSS. */
  width: number;
  height: number;
  /** B, H e h (m), já interpolados. */
  baseM: number;
  heightM: number;
  objectM: number;
  /** b e Δp (mm), vindos de `photoBaseM` e `parallaxDiffM` do domínio. */
  photoBaseMm: number;
  parallaxDiffMm: number;
  labels: StereoLabels;
}

/** O sensor de referência dos planos-imagem tem 36 mm de largura. */
const SENSOR_MM = 36;
const PULSES = 3;

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Escala (px/mm) de um plano-imagem: o sensor inteiro, ou menos se o ponto mais afastado não couber. */
export function imageScale(
  insetWidthPx: number,
  photoBaseMm: number,
  parallaxDiffMm: number,
): number {
  const farthestMm = (photoBaseMm + parallaxDiffMm) / 2;
  const full = insetWidthPx / SENSOR_MM;
  return farthestMm * full > insetWidthPx * 0.46 ? (insetWidthPx * 0.46) / farthestMm : full;
}

function insetFrame(ctx: CanvasRenderingContext2D, f: Frame, title: string): { ppX: number } {
  ctx.fillStyle = COLORS.bgPanel;
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  const ppX = f.x + f.w / 2;
  line(ctx, ppX, f.y, ppX, f.y + f.h, withAlpha(COLORS.textMuted, 0.5), 1, [3, 4]);
  text(ctx, title, f.x + f.w / 2, f.y - 10, { color: COLORS.textMuted, size: 11 });
  return { ppX };
}

/** Desenha o quadro do diagrama no instante `tS` (s). */
export function renderStereo(ctx: CanvasRenderingContext2D, view: StereoView, tS: number): void {
  const { width: w, height: h, labels } = view;
  ctx.save();
  ctx.fillStyle = COLORS.bgBase;
  ctx.fillRect(0, 0, w, h);

  // --- planos-imagem ampliados, no alto ---------------------------------------------------
  const topH = h * 0.34;
  const insetW = w * 0.26;
  const insetY = 34;
  const insetH = Math.max(60, topH - insetY - 26);
  const frames = {
    photo1: { x: w * 0.04, y: insetY, w: insetW, h: insetH },
    overlay: { x: w * 0.37, y: insetY, w: insetW, h: insetH },
    photo2: { x: w * 0.7, y: insetY, w: insetW, h: insetH },
  } as const;
  const k = imageScale(insetW, view.photoBaseMm, view.parallaxDiffMm);
  const halfBase = (view.photoBaseMm / 2) * k;
  const halfTop = ((view.photoBaseMm + view.parallaxDiffMm) / 2) * k;
  const yBase = insetY + insetH * 0.66;
  const yTop = insetY + insetH * 0.3;

  const p1 = insetFrame(ctx, frames.photo1, labels.photo1);
  const p2 = insetFrame(ctx, frames.photo2, labels.photo2);
  const ov = insetFrame(ctx, frames.overlay, labels.overlay);
  // Foto 1: o prédio aparece à direita do ponto principal; foto 2, à esquerda.
  line(ctx, p1.ppX + halfBase, yBase, p1.ppX + halfTop, yTop, withAlpha(COLORS.text, 0.45));
  dot(ctx, p1.ppX + halfBase, yBase, 4, COLORS.radar);
  dot(ctx, p1.ppX + halfTop, yTop, 4, COLORS.warn);
  line(ctx, p2.ppX - halfBase, yBase, p2.ppX - halfTop, yTop, withAlpha(COLORS.text, 0.45));
  dot(ctx, p2.ppX - halfBase, yBase, 4, COLORS.radar);
  dot(ctx, p2.ppX - halfTop, yTop, 4, COLORS.warn);
  // Sobreposição: as duas fotos alinhadas pelo ponto principal (○ foto 1, ● foto 2).
  dot(ctx, ov.ppX + halfBase, yBase, 4, COLORS.radar, true);
  dot(ctx, ov.ppX - halfBase, yBase, 4, COLORS.radar);
  dot(ctx, ov.ppX + halfTop, yTop, 4, COLORS.warn, true);
  dot(ctx, ov.ppX - halfTop, yTop, 4, COLORS.warn);
  dimension(
    ctx,
    ov.ppX - halfBase,
    yBase + 14,
    ov.ppX + halfBase,
    yBase + 14,
    labels.photoBase,
    COLORS.radar,
    13,
  );
  // Δp: o quanto o topo se afasta mais que a base, de cada lado.
  dimension(ctx, ov.ppX + halfBase, yTop - 12, ov.ppX + halfTop, yTop - 12, '', COLORS.warn, 0);
  dimension(ctx, ov.ppX - halfTop, yTop - 12, ov.ppX - halfBase, yTop - 12, '', COLORS.warn, 0);
  text(ctx, labels.parallax, ov.ppX, yTop - 24, {
    color: COLORS.warn,
    size: 12,
    mono: true,
    bold: true,
  });

  // --- mundo: câmeras, prédio e raios -----------------------------------------------------
  const regionBottom = h - 34;
  const regionTop = topH + 42;
  const ppm = Math.min(
    (w * 0.74) / (view.baseM + 24),
    ((regionBottom - regionTop) * 0.92) / Math.max(view.heightM, 1),
  );
  const cx = w * 0.5;
  const groundY = regionBottom;
  const camY = groundY - view.heightM * ppm;
  const x1 = cx - (view.baseM / 2) * ppm;
  const x2 = cx + (view.baseM / 2) * ppm;
  const topY = groundY - view.objectM * ppm;

  line(ctx, w * 0.06, groundY, w * 0.94, groundY, COLORS.textMuted, 2);
  text(ctx, labels.ground, w * 0.94, groundY + 14, {
    color: COLORS.textMuted,
    size: 10,
    align: 'right',
  });

  // Prédio (cresce com h).
  const bw = Math.min(14, Math.max(4, view.baseM / 4)) * ppm;
  ctx.fillStyle = withAlpha(COLORS.radar, 0.14);
  ctx.strokeStyle = COLORS.radar;
  ctx.lineWidth = 1.5;
  ctx.fillRect(cx - bw / 2, topY, bw, groundY - topY);
  ctx.strokeRect(cx - bw / 2, topY, bw, groundY - topY);
  ctx.fillStyle = withAlpha(COLORS.radar, 0.3);
  for (let y = topY + 8; y < groundY - 6; y += 12) {
    ctx.fillRect(cx - bw / 2 + 4, y, Math.max(2, bw - 8), 4);
  }

  // Raios de cada câmera até o topo (âmbar) e a base (ciano), com pulsos subindo até a câmera.
  const rays: Array<[number, number, number, number, string, readonly number[]]> = [
    [x1, camY, cx, topY, COLORS.warn, []],
    [x2, camY, cx, topY, COLORS.warn, []],
    [x1, camY, cx, groundY, COLORS.radar, [5, 4]],
    [x2, camY, cx, groundY, COLORS.radar, [5, 4]],
  ];
  for (const [rx, ry, tx, ty, color, dash] of rays) {
    line(ctx, rx, ry, tx, ty, withAlpha(color, 0.75), 1.5, dash);
    for (let i = 0; i < PULSES; i++) {
      const u = (tS * 0.4 + i / PULSES) % 1;
      dot(ctx, tx + (rx - tx) * u, ty + (ry - ty) * u, 2.2, color);
    }
  }
  dot(ctx, cx, topY, 5, COLORS.warn);
  dot(ctx, cx, groundY, 5, COLORS.radar);
  text(ctx, labels.top, cx + bw / 2 + 8, topY, { color: COLORS.warn, size: 11, align: 'left' });

  // Câmeras C1 e C2.
  for (const [x, name] of [
    [x1, 'C1'],
    [x2, 'C2'],
  ] as const) {
    ctx.fillStyle = COLORS.bgRaised;
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - 12, camY - 12, 24, 12);
    ctx.strokeRect(x - 12, camY - 12, 24, 12);
    ctx.beginPath();
    ctx.moveTo(x - 5, camY);
    ctx.lineTo(x + 5, camY);
    ctx.lineTo(x, camY + 6);
    ctx.closePath();
    ctx.fillStyle = COLORS.text;
    ctx.fill();
    text(ctx, name, x, camY - 24, { color: COLORS.text, size: 12, bold: true });
  }

  // Cotas: B entre as câmeras, H à esquerda e h ao lado do prédio.
  dimension(ctx, x1, camY - 42, x2, camY - 42, labels.base, COLORS.text, -12);
  const hx = Math.max(w * 0.06, x1 - 56);
  dimension(ctx, hx, camY, hx, groundY, labels.height, COLORS.textMuted, -8);
  dimension(ctx, cx + bw / 2 + 36, topY, cx + bw / 2 + 36, groundY, labels.object, COLORS.warn, 8);
  ctx.restore();
}
