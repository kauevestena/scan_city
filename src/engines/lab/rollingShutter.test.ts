import { rollingShutterSkewPx } from '@/domain/photogrammetry';
import {
  captureImage,
  POLE,
  sampleRollingShutter,
  sceneColor,
  SHUTTER_COLS,
  SHUTTER_ROWS,
  type ShutterScene,
} from './rollingShutter';

const scene = (patch: Partial<ShutterScene> = {}): ShutterScene => ({
  rows: SHUTTER_ROWS,
  cols: SHUTTER_COLS,
  gsdM: 0.027412,
  spinRadS: 0,
  ...patch,
});

/** Centro (px) do poste numa linha da imagem capturada, a partir das colunas cor do poste. */
function poleCenter(image: Uint8ClampedArray, row: number): number {
  const xs: number[] = [];
  for (let col = 0; col < SHUTTER_COLS; col++) {
    const k = (row * SHUTTER_COLS + col) * 4;
    if (image[k] === 226 && image[k + 1] === 232 && image[k + 2] === 240) xs.push(col + 0.5);
  }
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

describe('sampleRollingShutter (infographic-lab §9: pura e testada)', () => {
  it('G11 — v 8 m/s, leitura de 30 ms, GSD 2,7412 cm: a última linha anda 8,7552 px', () => {
    const rows = sampleRollingShutter(scene(), 0, 0.03, 8);
    expect(rows).toHaveLength(SHUTTER_ROWS);
    expect(rows[0]?.dx).toBe(0);
    expect(rows.at(-1)?.dx).toBeCloseTo(8.7552, 3);
    // É exatamente o skew do domínio.
    expect(rows.at(-1)?.dx).toBeCloseTo(rollingShutterSkewPx(8, 0.03, 0.027412), 12);
  });

  it('cada linha é lida em seu instante: de t0 a t0 + leitura, em passos iguais', () => {
    const rows = sampleRollingShutter(scene(), 2, 0.03, 8);
    expect(rows[0]?.timeS).toBe(2);
    expect(rows.at(-1)?.timeS).toBeCloseTo(2.03, 12);
    const step = (rows[1]?.timeS ?? 0) - (rows[0]?.timeS ?? 0);
    for (let k = 1; k < rows.length; k++) {
      expect((rows[k]?.timeS ?? 0) - (rows[k - 1]?.timeS ?? 0)).toBeCloseTo(step, 12);
    }
    // O deslocamento é linear nas linhas (cisalhamento).
    const dxStep = (rows[1]?.dx ?? 0) - (rows[0]?.dx ?? 0);
    expect((rows[80]?.dx ?? 0) - (rows[79]?.dx ?? 0)).toBeCloseTo(dxStep, 9);
  });

  it('com v = 0 ou sensor global (leitura 0), nenhuma linha se desloca', () => {
    for (const r of sampleRollingShutter(scene(), 0, 0.03, 0)) expect(r.dx).toBe(0);
    for (const r of sampleRollingShutter(scene(), 0, 0, 25)) expect(r.dx).toBe(0);
  });

  it('o giro acumula na leitura: θ = −ω · Δt, nulo sem giro', () => {
    const spin = (90 * Math.PI) / 180;
    const rows = sampleRollingShutter(scene({ spinRadS: spin }), 0, 0.06, 0);
    expect(rows[0]?.theta).toBeCloseTo(0, 12);
    expect(rows.at(-1)?.theta).toBeCloseTo(-spin * 0.06, 12);
    for (const r of sampleRollingShutter(scene(), 0, 0.06, 5)) expect(r.theta).toBeCloseTo(0, 12);
  });

  it('uma imagem de uma linha não divide por zero', () => {
    const rows = sampleRollingShutter(scene({ rows: 1 }), 0, 0.03, 8);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dx).toBe(0);
  });
});

describe('captureImage', () => {
  it('sem movimento nem giro, o rolling é idêntico à cena global', () => {
    const still = captureImage(scene(), sampleRollingShutter(scene(), 0, 0.03, 0), SHUTTER_ROWS);
    const global = captureImage(scene(), sampleRollingShutter(scene(), 0, 0, 25), SHUTTER_ROWS);
    expect(Array.from(still)).toEqual(Array.from(global));
    // E bate com a cena analítica pixel a pixel.
    const k = (80 * SHUTTER_COLS + 152) * 4;
    expect([still[k], still[k + 1], still[k + 2]]).toEqual(Array.from(sceneColor(152.5, 80.5)));
  });

  it('G11 — o poste sai inclinado: o centro dele anda o skew de uma ponta à outra', () => {
    const samples = sampleRollingShutter(scene(), 0, 0.03, 8);
    const image = captureImage(scene(), samples, SHUTTER_ROWS);
    const first = poleCenter(image, POLE.top + 1);
    const last = poleCenter(image, POLE.bottom - 1);
    const expected = (samples[POLE.bottom - 1]?.dx ?? 0) - (samples[POLE.top + 1]?.dx ?? 0);
    expect(last - first).toBeCloseTo(expected, 0);
    expect(last - first).toBeGreaterThan(5);
    // Linear: o poste é reto, só inclinado.
    const mid = poleCenter(image, Math.round((POLE.top + POLE.bottom) / 2));
    // O centro anda em colunas inteiras: meia coluna de folga.
    expect(Math.abs(mid - first - (last - first) / 2)).toBeLessThanOrEqual(1);
  });

  it('o sensor global não inclina: o poste fica na mesma coluna em todas as linhas', () => {
    const image = captureImage(scene(), sampleRollingShutter(scene(), 0, 0, 25), SHUTTER_ROWS);
    expect(poleCenter(image, POLE.top + 1)).toBe(poleCenter(image, POLE.bottom - 1));
    expect(poleCenter(image, 60)).toBeCloseTo(POLE.x + POLE.width / 2, 9);
  });

  it('com giro o poste se curva (gelatina): o centro deixa de ser linear nas linhas', () => {
    const spin = (90 * Math.PI) / 180;
    const sc = scene({ spinRadS: spin });
    const image = captureImage(sc, sampleRollingShutter(sc, 0, 0.06, 0), SHUTTER_ROWS);
    const a = poleCenter(image, 30);
    const b = poleCenter(image, 85);
    const c = poleCenter(image, 130);
    // Sem curvatura, b seria a média de a e c.
    expect(Math.abs(b - (a + c) / 2)).toBeGreaterThan(0.3);
    // E o giro desloca o poste em relação ao eixo.
    expect(Math.abs(c - a)).toBeGreaterThan(1);
  });

  it('só as linhas já lidas aparecem; as demais ficam transparentes', () => {
    const samples = sampleRollingShutter(scene(), 0, 0.03, 8);
    const image = captureImage(scene(), samples, 40);
    expect(image[(39 * SHUTTER_COLS + 5) * 4 + 3]).toBe(255);
    expect(image[(40 * SHUTTER_COLS + 5) * 4 + 3]).toBe(0);
    expect(captureImage(scene(), samples, 0).every((v) => v === 0)).toBe(true);
    expect(captureImage(scene(), samples, 9999).at(-1)).toBe(255);
  });

  it('reaproveita o buffer informado', () => {
    const buffer = new Uint8ClampedArray(SHUTTER_COLS * SHUTTER_ROWS * 4);
    const out = captureImage(scene(), sampleRollingShutter(scene(), 0, 0, 0), SHUTTER_ROWS, buffer);
    expect(out).toBe(buffer);
  });
});
