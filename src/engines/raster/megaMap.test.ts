import { C00 } from '@/data/contracts';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  MEGAMAP_BARREL_K,
  MEGAMAP_OFFSET_MAX_M,
  MEGAMAP_OFFSET_MIN_M,
  distortOrtho,
  megaMapParams,
} from './megaMap';
import { aoiRasterSize, orthoPixels } from './orthoPreview';

const terrain = createTerrain(C00);
const size = aoiRasterSize(C00.aoi, 96);
const ortho = orthoPixels(terrain, size);
const scale = { x: C00.aoi.lengthM / size.width, y: C00.aoi.widthM / size.height };

describe('mapa MegaMap (REQ-PRG-011c)', () => {
  it('o deslocamento fica entre 2 e 6 m, é determinístico pela seed e varia entre missões', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const p = megaMapParams(seed);
      expect(p.offsetM).toBeGreaterThanOrEqual(MEGAMAP_OFFSET_MIN_M);
      expect(p.offsetM).toBeLessThanOrEqual(MEGAMAP_OFFSET_MAX_M);
      expect(p.k).toBe(MEGAMAP_BARREL_K);
      seen.add(Math.round(p.offsetM * 100));
    }
    expect(seen.size).toBeGreaterThan(100);
    expect(megaMapParams(42)).toEqual(megaMapParams(42));
    expect(megaMapParams(42)).not.toEqual(megaMapParams(43));
  });

  it('a orto sai deformada, determinística e opaca', () => {
    const params = megaMapParams(7);
    const a = distortOrtho(ortho, size.width, size.height, params, scale);
    const b = distortOrtho(ortho, size.width, size.height, params, scale);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(ortho));
    for (let k = 3; k < a.length; k += 4) expect(a[k]).toBe(255);
  });

  it('sem deslocamento nem barril, é a identidade; o deslocamento move a imagem por offset/escala px', () => {
    const id = distortOrtho(
      ortho,
      size.width,
      size.height,
      { offsetM: 0, angleRad: 0, k: 0 },
      scale,
    );
    expect(Array.from(id)).toEqual(Array.from(ortho));
    // 4 m para leste, sem barril: o conteúdo do pixel x vem do pixel x − 4/escala.
    const shifted = distortOrtho(
      ortho,
      size.width,
      size.height,
      { offsetM: 4, angleRad: 0, k: 0 },
      scale,
    );
    const px = Math.round(4 / scale.x);
    const y = Math.floor(size.height / 2);
    const x = Math.floor(size.width / 2);
    const at = (i: number) => (y * size.width + i) * 4;
    // Compara só onde o deslocamento é inteiro (aproximação por proximidade de cor).
    const err = (i: number) =>
      Math.abs((shifted[at(i)] as number) - (ortho[at(i - px)] as number)) +
      Math.abs((shifted[at(i) + 1] as number) - (ortho[at(i - px) + 1] as number));
    const exact = Array.from({ length: 8 }, (_, d) => err(x + d)).reduce((s, v) => s + v, 0);
    const wrong = Array.from({ length: 8 }, (_, d) =>
      Math.abs((shifted[at(x + d)] as number) - (ortho[at(x + d)] as number)),
    ).reduce((s, v) => s + v, 0);
    expect(exact).toBeLessThanOrEqual(wrong + 1e-9);
  });

  it('o barril comprime as bordas: o centro quase não muda e os cantos sim', () => {
    const k = distortOrtho(
      ortho,
      size.width,
      size.height,
      { offsetM: 0, angleRad: 0, k: 0.3 },
      scale,
    );
    const diff = (x: number, y: number) => {
      const o = (y * size.width + x) * 4;
      return (
        Math.abs((k[o] as number) - (ortho[o] as number)) +
        Math.abs((k[o + 1] as number) - (ortho[o + 1] as number))
      );
    };
    const cx = Math.floor(size.width / 2);
    const cy = Math.floor(size.height / 2);
    let center = 0;
    let corner = 0;
    for (let d = -3; d <= 3; d++) {
      center += diff(cx + d, cy);
      corner += diff(4 + d + 3, 4);
    }
    expect(corner).toBeGreaterThan(center);
  });

  it('o canto fica com a cor de fora quando o deslocamento puxa para além da orto', () => {
    const out = distortOrtho(
      ortho,
      size.width,
      size.height,
      { offsetM: 6, angleRad: 0, k: 0 },
      scale,
    );
    // Deslocar para leste deixa a borda oeste sem origem.
    expect([out[0], out[1], out[2]]).toEqual([15, 23, 42]);
  });
});
