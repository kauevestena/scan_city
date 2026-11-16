import {
  canopyFormulas,
  canopyLabels,
  densityText,
  gsdText,
  opticsFormulas,
  opticsLabels,
  shutterFormulas,
  shutterLabels,
  stereoFormulas,
  stereoLabels,
} from './labels';
import {
  canopyReadings,
  opticsReadings,
  shutterReadings,
  stereoReadings,
  type CanopyInput,
  type OpticsInput,
  type ShutterInput,
  type StereoInput,
} from './readings';

const G2: OpticsInput = { heightM: 100, focalMm: 35, pixelUm: 4.38, sensorWidthMm: 36 };
const G14: StereoInput = { baseM: 30, heightM: 100, objectM: 20, focalMm: 35, sigmaPx: 0.5 };

describe('textos do Laboratório', () => {
  it('GSD em cm/px com vírgula e duas casas', () => {
    expect(gsdText(0.0125143)).toBe('1,25 cm/px');
    expect(gsdText(0.0274)).toBe('2,74 cm/px');
  });

  it('as fórmulas de óptica trazem os valores substituídos (G2)', () => {
    const [gsd, wg, fov] = opticsFormulas(G2, opticsReadings(G2));
    expect(gsd).toBe('GSD = (H × s) / f = (100 m × 4,38 µm) / 35,0 mm = 1,25 cm/px');
    expect(wg).toBe('W_g = (H × L) / f = (100 m × 36,0 mm) / 35,0 mm = 102,9 m');
    expect(fov).toMatch(/^FOV = 2·atan\(L \/ 2f\) = 54,\d°$/);
  });

  it('os rótulos do diagrama de óptica', () => {
    const l = opticsLabels(G2, opticsReadings(G2));
    expect(l.height).toBe('H = 100 m');
    expect(l.focal).toBe('f = 35,0 mm');
    expect(l.ground).toBe('W_g = 102,9 m');
    expect(l.gsd).toBe('GSD 1,25 cm/px');
    expect(l.pixel).toBe('pixel 4,38 µm');
  });

  it('as fórmulas de estereoscopia trazem b, Δp, h e σ_Z (G14, G15)', () => {
    const lines = stereoFormulas(G14, stereoReadings(G14));
    expect(lines[0]).toBe('b = B·f / H = (30 m × 35,0 mm) / 100 m = 10,50 mm');
    expect(lines[1]).toBe('Δp = B·f·h / (H·(H − h)) = 2,625 mm');
    expect(lines[2]).toBe('h = H·Δp / (b + Δp) = 20,00 m');
    expect(lines[3]).toBe('σ_Z = H² / (B·f) · σ = 2,09 cm');
  });

  it('os rótulos do diagrama de estereoscopia', () => {
    const l = stereoLabels(G14, stereoReadings(G14));
    expect([l.base, l.height, l.object, l.photoBase, l.parallax]).toEqual([
      'B = 30 m',
      'H = 100 m',
      'h = 20,0 m',
      'b = 10,50 mm',
      'Δp = 2,625 mm',
    ]);
  });
});

const G16: CanopyInput = { canopyPct: 97, maxReturns: 5, prrKHz: 240, heightM: 80, speedMs: 10 };
const G11: ShutterInput = { speedMs: 8, readoutMs: 30, spinDegS: 0, gsdCm: 2.74, global: false };

describe('textos do dossel', () => {
  it('densidade com uma casa', () => {
    expect(densityText(214.22)).toBe('214,2 pts/m²');
    expect(densityText(0.095)).toBe('0,1 pts/m²');
  });

  it('as fórmulas trazem P_solo (G16), a faixa e as densidades', () => {
    const lines = canopyFormulas(G16, canopyReadings(G16));
    expect(lines[0]).toBe('P_solo = (1 − c) + c · 0,02 · (n − 1) = 10,76 %  (c = 97 %, n = 5)');
    expect(lines[1]).toBe('faixa = 2·H·tan(FOV / 2) = 112,0 m');
    expect(lines[2]).toBe('ρ = PRR / (v · faixa) = 214,2 pts/m²');
    expect(lines[3]).toMatch(/^ρ_solo = ρ · P_solo = 23,\d pts\/m²$/);
    expect(lines[4]).toBe('fotos: (1 − c)² = 0,09 %');
  });

  it('os rótulos do diagrama vêm das strings', () => {
    expect(canopyLabels().first).toBe('1º retorno');
    expect(canopyLabels().photoDtm).toContain('MDT fotogramétrico');
  });
});

describe('textos do shutter', () => {
  it('as fórmulas trazem o skew (G11) e o ângulo de cisalhamento', () => {
    const [skew, angle] = shutterFormulas(G11, shutterReadings(G11));
    expect(skew).toBe('skew = v · t_readout / GSD = (8,0 m/s × 30 ms) / 2,74 cm = 8,76 px');
    expect(angle).toMatch(
      /^ângulo = atan\(skew · GSD \/ altura no solo\) = atan\(0,24 m \/ 4,4 m\) = 3,13°$/,
    );
  });

  it('com sensor global a leitura é 0 ms e o rótulo da varredura some', () => {
    const g = { ...G11, global: true };
    expect(shutterFormulas(g, shutterReadings(g))[0]).toContain('× 0 ms');
    expect(shutterLabels(g, shutterReadings(g)).sweep).toBe('');
    expect(shutterLabels(G11, shutterReadings(G11)).sweep).toBe('varredura de leitura');
  });

  it('o rótulo do skew mostra o valor com duas casas', () => {
    expect(shutterLabels(G11, shutterReadings(G11)).skew).toBe('skew = 8,76 px');
  });
});
