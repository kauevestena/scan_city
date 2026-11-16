/**
 * Captura por linha do rolling shutter (infographic-lab §5.4, REQ-LAB-004). Cada linha da imagem
 * é lida no instante em que a varredura passa por ela: uma cena que se move sai cisalhada (o poste
 * inclina) e uma câmera que gira, curvada, o efeito "gelatina". `sampleRollingShutter` é pura: diz,
 * para cada linha, quanto a cena andou e girou até aquele instante; `captureImage` só aplica isso.
 */
import { rollingShutterSkewPx } from '@/domain/photogrammetry';

/** Imagem de demonstração: um sensor virtual cuja leitura inteira dura o `t_readout`. */
export const SHUTTER_COLS = 240;
export const SHUTTER_ROWS = 160;

export interface ShutterScene {
  rows: number;
  cols: number;
  /** GSD (m/px): converte a velocidade (m/s) em px/s. */
  gsdM: number;
  /** Giro da câmera em torno do eixo óptico (rad/s); 0 sem giro. */
  spinRadS: number;
}

export interface RowSample {
  /** Instante (s) em que a linha é lida. */
  timeS: number;
  /** Quanto a cena andou na horizontal desde o início da leitura (px). */
  dx: number;
  /** Quanto a cena girou desde o início da leitura, em torno do centro (rad). */
  theta: number;
}

/**
 * Amostra de cada linha: a primeira é lida em `t0S` e a última em `t0S + readoutS`. O deslocamento
 * vem do domínio (`rollingShutterSkewPx`), então a última linha tem exatamente o skew da leitura.
 * Sem leitura por linha (`readoutS = 0`, sensor global), todas as linhas saem do mesmo instante.
 */
export function sampleRollingShutter(
  scene: ShutterScene,
  t0S: number,
  readoutS: number,
  speedMs: number,
): RowSample[] {
  const last = Math.max(1, scene.rows - 1);
  return Array.from({ length: scene.rows }, (_, row) => {
    const timeS = t0S + (readoutS * row) / last;
    return {
      timeS,
      dx: rollingShutterSkewPx(speedMs, timeS - t0S, scene.gsdM),
      theta: -scene.spinRadS * (timeS - t0S),
    };
  });
}

type Rgb = readonly [number, number, number];

const BACKGROUND: Rgb = [12, 18, 34];
const GROUND: Rgb = [30, 41, 59];
const BUILDING: Rgb = [96, 112, 140];
const WINDOW: Rgb = [250, 204, 90];
const POLE_COLOR: Rgb = [226, 232, 240];
const SQUARE: Rgb = [34, 211, 238];

/** O poste na cena (px): a coluna da esquerda, a largura e as linhas em que existe. */
export const POLE = { x: 150, width: 6, top: 14, bottom: 140 } as const;
const GROUND_Y = 140;

const inside = (v: number, lo: number, hi: number) => v >= lo && v < hi;

/** A cena analítica: prédio com janelas, poste vertical e uma grade de quadrados, sobre o chão. */
export function sceneColor(x: number, y: number): Rgb {
  if (inside(x, POLE.x, POLE.x + POLE.width) && inside(y, POLE.top, POLE.bottom)) {
    return POLE_COLOR;
  }
  if (inside(x, 24, 112) && inside(y, 44, GROUND_Y)) {
    // Janelas: 4 colunas por 5 linhas de 10 × 12 px, de 20 em 18 px.
    const wx = x - 32;
    const wy = y - 52;
    if (wx >= 0 && wy >= 0 && wx < 80 && wy < 90 && wx % 20 < 10 && wy % 18 < 12) return WINDOW;
    return BUILDING;
  }
  if (inside(x, 176, 236) && inside(y, 36, 96)) {
    // Quadrados de 14 px com vãos de 6 px (3 × 3).
    if ((x - 176) % 20 < 14 && (y - 36) % 20 < 14) return SQUARE;
  }
  return y >= GROUND_Y ? GROUND : BACKGROUND;
}

/**
 * Pixels (RGBA) das linhas `0 … upToRow − 1`, cada uma da cena movida e girada como em `samples`;
 * as demais ficam transparentes (ainda não lidas).
 */
export function captureImage(
  scene: ShutterScene,
  samples: readonly RowSample[],
  upToRow: number,
  out: Uint8ClampedArray = new Uint8ClampedArray(scene.cols * scene.rows * 4),
): Uint8ClampedArray {
  out.fill(0);
  const cx = scene.cols / 2;
  const cy = scene.rows / 2;
  const rows = Math.min(scene.rows, Math.max(0, Math.floor(upToRow)));
  for (let row = 0; row < rows; row++) {
    const { dx, theta } = samples[row] as RowSample;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const v = row + 0.5 - cy;
    for (let col = 0; col < scene.cols; col++) {
      // Inverso de "cena girada por θ em torno do centro e deslocada por dx".
      const u = col + 0.5 - cx - dx;
      const [r, g, b] = sceneColor(u * cos + v * sin + cx, -u * sin + v * cos + cy);
      const k = (row * scene.cols + col) * 4;
      out[k] = r;
      out[k + 1] = g;
      out[k + 2] = b;
      out[k + 3] = 255;
    }
  }
  return out;
}
