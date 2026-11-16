import { gsdText, opticsFormulas, opticsLabels, stereoFormulas, stereoLabels } from './labels';
import { opticsReadings, stereoReadings, type OpticsInput, type StereoInput } from './readings';

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
