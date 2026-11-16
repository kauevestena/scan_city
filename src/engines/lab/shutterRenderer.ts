/**
 * Diagrama de Global Shutter vs. Rolling Shutter (infographic-lab §5.4, REQ-LAB-004): uma cena
 * (prédio com janelas, poste vertical e grade de quadrados) se move sob a câmera; à esquerda, a
 * cena como ela é; à direita, a imagem "capturada" linha a linha, enquanto uma varredura ciano
 * desce pela imagem ao longo de `t_readout` (em câmera lenta, 20×). O rolling inclina o poste,
 * cisalha o prédio e, com giro, o curva; o global sai idêntico à cena.
 *
 * Só desenha: quem chama passa as leituras do domínio já formatadas; a amostragem por linha é a
 * função pura `sampleRollingShutter`.
 */
import { COLORS, withAlpha } from '@/ui/tokens';
import { dot, line, text } from './draw';
import {
  captureImage,
  POLE,
  sampleRollingShutter,
  SHUTTER_COLS,
  SHUTTER_ROWS,
  type RowSample,
  type ShutterScene,
} from './rollingShutter';

export interface ShutterLabels {
  scene: string;
  rolling: string;
  global: string;
  slowMotion: string;
  skew: string;
  reference: string;
  sweep: string;
}

export interface ShutterView {
  /** Área de desenho, em px CSS. */
  width: number;
  height: number;
  /** Velocidade (m/s), leitura (s), giro (rad/s) e GSD (m/px): valores já interpolados. */
  speedMs: number;
  readoutS: number;
  spinRadS: number;
  gsdM: number;
  /** Sensor global: captura tudo no mesmo instante. */
  global: boolean;
  labels: ShutterLabels;
}

/** A varredura é mostrada em câmera lenta: 20× mais devagar que a leitura real. */
export const SLOW_MOTION = 20;
/** Pausa com a captura completa antes de repetir o ciclo. */
export const HOLD_S = 1.4;

/** Duração de um ciclo (varredura em câmera lenta mais a pausa), em segundos. */
export function cycleDurationS(readoutS: number): number {
  return readoutS * SLOW_MOTION + HOLD_S;
}

/** Em que ponto do ciclo estamos em `tS`: fração da varredura (0 a 1) e o instante simulado. */
export function sweepAt(tS: number, readoutS: number): { progress: number; simS: number } {
  const slow = readoutS * SLOW_MOTION;
  const phase =
    ((tS % cycleDurationS(readoutS)) + cycleDurationS(readoutS)) % cycleDurationS(readoutS);
  const progress = slow > 0 ? Math.min(1, phase / slow) : 1;
  return { progress, simS: progress * readoutS };
}

const offscreen = new Map<string, HTMLCanvasElement>();

/** Desenha os pixels RGBA (cols × rows) no retângulo (x, y, w, h), sem suavizar. */
function blit(
  ctx: CanvasRenderingContext2D,
  key: string,
  data: Uint8ClampedArray,
  frame: { x: number; y: number; w: number; h: number },
): void {
  let canvas = offscreen.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = SHUTTER_COLS;
    canvas.height = SHUTTER_ROWS;
    offscreen.set(key, canvas);
  }
  const octx = canvas.getContext('2d');
  if (!octx) return;
  octx.putImageData(
    new ImageData(data as Uint8ClampedArray<ArrayBuffer>, SHUTTER_COLS, SHUTTER_ROWS),
    0,
    0,
  );
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, frame.x, frame.y, frame.w, frame.h);
}

const sceneOf = (view: ShutterView): ShutterScene => ({
  rows: SHUTTER_ROWS,
  cols: SHUTTER_COLS,
  gsdM: view.gsdM,
  spinRadS: view.spinRadS,
});

/** A cena como ela está no instante `simS`: todas as linhas com o mesmo deslocamento e giro. */
function uniformSamples(rows: readonly RowSample[], index: number): RowSample[] {
  const at = rows[Math.min(rows.length - 1, Math.max(0, index))] as RowSample;
  return rows.map(() => at);
}

const sceneBuffer = new Uint8ClampedArray(SHUTTER_COLS * SHUTTER_ROWS * 4);
const captureBuffer = new Uint8ClampedArray(SHUTTER_COLS * SHUTTER_ROWS * 4);

/** Desenha o quadro do diagrama no instante `tS` (s). */
export function renderShutter(ctx: CanvasRenderingContext2D, view: ShutterView, tS: number): void {
  const { width: w, height: h, labels } = view;
  ctx.save();
  ctx.fillStyle = COLORS.bgBase;
  ctx.fillRect(0, 0, w, h);

  const readoutS = view.global ? 0 : view.readoutS;
  const scene = sceneOf(view);
  const { progress } = sweepAt(tS, view.readoutS);
  const scale = Math.min((w * 0.44) / SHUTTER_COLS, (h * 0.58) / SHUTTER_ROWS);
  const iw = SHUTTER_COLS * scale;
  const ih = SHUTTER_ROWS * scale;
  const top = 78;
  const left = { x: w * 0.04, y: top, w: iw, h: ih };
  const right = { x: w * 0.96 - iw, y: top, w: iw, h: ih };

  // Cena à esquerda: como ela está agora (andou e girou desde o início da leitura).
  const samples = sampleRollingShutter(scene, 0, view.readoutS, view.speedMs);
  const row = Math.round(progress * (SHUTTER_ROWS - 1));
  blit(ctx, 'scene', fillScene(scene, uniformSamples(samples, row)), left);

  // Captura à direita: linha a linha (rolling) ou toda de uma vez (global).
  const captureSamples = sampleRollingShutter(scene, 0, readoutS, view.speedMs);
  const scanned = view.global ? SHUTTER_ROWS : Math.round(progress * SHUTTER_ROWS);
  blit(ctx, 'capture', captureImage(scene, captureSamples, scanned, captureBuffer), right);

  for (const f of [left, right]) {
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
  }
  text(ctx, labels.scene, left.x + iw / 2, top - 20, { color: COLORS.textMuted, size: 12 });
  text(ctx, view.global ? labels.global : labels.rolling, right.x + iw / 2, top - 20, {
    color: view.global ? COLORS.ok : COLORS.warn,
    size: 12,
    bold: true,
  });

  // Varredura ciano (só no rolling, enquanto lê): desce pelas duas imagens.
  if (!view.global && progress < 1) {
    const y = top + progress * ih;
    for (const f of [left, right]) {
      line(ctx, f.x - 6, y, f.x + f.w + 6, y, COLORS.radar, 2);
    }
    dot(ctx, left.x - 8, y, 3, COLORS.radar);
    dot(ctx, right.x + right.w + 8, y, 3, COLORS.radar);
    text(ctx, labels.sweep, right.x + iw / 2, top + ih + 38, { color: COLORS.radar, size: 11 });
  }
  text(ctx, labels.slowMotion, w / 2, top - 44, { color: COLORS.textMuted, size: 11 });

  // Referência: a coluna do poste na cena (âmbar tracejado) sobre a imagem capturada, para ver a inclinação.
  const poleX = right.x + (POLE.x + POLE.width / 2) * scale;
  line(ctx, poleX, right.y, poleX, right.y + ih, withAlpha(COLORS.warn, 0.6), 1, [4, 4]);
  text(ctx, labels.reference, poleX, top + ih + 14, { color: COLORS.warn, size: 11 });
  text(ctx, labels.skew, right.x + iw / 2, top + ih + 60, {
    color: COLORS.warn,
    size: 13,
    mono: true,
    bold: true,
  });
  ctx.restore();
}

function fillScene(scene: ShutterScene, samples: readonly RowSample[]): Uint8ClampedArray {
  return captureImage(scene, samples, scene.rows, sceneBuffer);
}
