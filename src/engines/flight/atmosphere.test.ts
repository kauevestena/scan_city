import { C00 } from '@/data/contracts';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  buildWisps,
  drawHorizonHaze,
  drawSpeedStreaks,
  drawVignette,
  drawWisps,
  overscanPx,
  ROLL_MAX_RAD,
  rollTarget,
  SkyPainter,
  SPEED_STREAKS,
  speedIntensity,
  speedStreaks,
  stepRoll,
  sunOnScreen,
  WISP_NEAR_DEPTH_M,
  type SkyInput,
} from './atmosphere';
import { makeCamera } from './projection';

const ctx2d = () => document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
const palette = createTerrain(C00).palette;
const sky = (over: Partial<SkyInput> = {}): SkyInput => ({
  width: 1280,
  height: 720,
  horizonY: 252,
  focalPx: 914,
  palette,
  lighting: 'GOLDEN_HOUR',
  sun: { x: 0.1, z: 0.98, up: 0.14 },
  quality: 'HIGH',
  ...over,
});

describe('inclinação da câmera', () => {
  it('deita para o lado em que a aeronave escorrega, até 5°; nada com reduceFlashes', () => {
    expect(rollTarget(0, 8, false)).toBeCloseTo(0, 12);
    expect(rollTarget(4, 8, false)).toBeCloseTo(-ROLL_MAX_RAD / 2, 9);
    expect(rollTarget(-80, 8, false)).toBeCloseTo(ROLL_MAX_RAD, 9);
    expect(rollTarget(8, 8, true)).toBe(0);
  });

  it('segue o pedido com amortecimento, em tempo real', () => {
    const half = stepRoll(0, 1, Math.log(2) / 5);
    expect(half).toBeCloseTo(0.5, 9);
    expect(stepRoll(0.3, 1, 0)).toBe(0.3);
    let r = 0;
    for (let k = 0; k < 120; k++) r = stepRoll(r, 1, 1 / 60);
    expect(r).toBeGreaterThan(0.99);
  });

  it('a folga da tela cobre os cantos girados', () => {
    const m = overscanPx(1280);
    // A 5°, o canto de uma tela 16:9 sai ~56 px na vertical e ~31 px na horizontal.
    expect(m).toBeGreaterThanOrEqual(Math.ceil(640 * Math.sin(ROLL_MAX_RAD)));
  });
});

describe('céu', () => {
  it('o sol à frente cai acima do horizonte; atrás da câmera, não aparece', () => {
    const p = sunOnScreen({ x: 0, z: 1, up: 0.1 }, 1280, 914);
    expect(p?.x).toBeCloseTo(640, 9);
    expect(p?.y).toBeCloseTo(-91.4, 9);
    expect(sunOnScreen({ x: 0, z: -0.5, up: 0.1 }, 1280, 914)).toBeNull();
    expect(sunOnScreen(null, 1280, 914)).toBeNull();
  });

  it('pinta o bitmap uma vez e só copia nos quadros seguintes; repinta com outro rumo', () => {
    const painter = new SkyPainter();
    const ctx = ctx2d();
    painter.paint(ctx, sky());
    painter.paint(ctx, sky({ horizonY: 300 }));
    expect(painter.repaints).toBe(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    painter.paint(ctx, sky({ sun: { x: -0.4, z: 0.8, up: 0.14 } }));
    expect(painter.repaints).toBe(2);
    // As linhas em zigue-zague alternam dois rumos: os dois bitmaps ficam guardados.
    painter.paint(ctx, sky());
    painter.paint(ctx, sky({ sun: { x: -0.4, z: 0.8, up: 0.14 } }));
    expect(painter.repaints).toBe(2);
    painter.paint(ctx, sky({ lighting: 'OVERCAST', sun: null }));
    painter.paint(ctx, sky());
    expect(painter.repaints).toBe(4);
  });

  it('a decolagem só desloca a cópia: o horizonte da tela é o do bitmap', () => {
    const painter = new SkyPainter();
    const ctx = ctx2d();
    painter.paint(ctx, sky({ horizonY: 252 }));
    painter.paint(ctx, sky({ horizonY: 400 }));
    const calls = vi.mocked(ctx.drawImage).mock.calls as unknown as Array<
      [unknown, number, number]
    >;
    expect((calls[1]?.[2] ?? 0) - (calls[0]?.[2] ?? 0)).toBeCloseTo(148, 0);
  });

  it('névoa do horizonte e vinheta saem em gradiente, uma faixa cada', () => {
    const ctx = ctx2d();
    drawHorizonHaze(ctx, 1280, 720, 252, palette.fog);
    drawVignette(ctx, 1280, 720);
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(3);
    expect(ctx.fillRect).toHaveBeenCalledTimes(3);
  });
});

describe('riscos de velocidade', () => {
  it('só aparecem quando o mundo passa rápido, e mais com o cruzeiro', () => {
    expect(speedIntensity(8, 1)).toBe(0);
    expect(speedIntensity(10, 1.75)).toBeGreaterThan(0);
    expect(speedIntensity(10, 7)).toBe(1);
    expect(speedStreaks(1280, 720, 252, 0, 1, 'HIGH')).toEqual([]);
  });

  it('ficam na coroa de fora: o centro, onde voa a aeronave, fica limpo', () => {
    const segs = speedStreaks(1280, 720, 252, 1, 3, 'HIGH');
    expect(segs.length / 4).toBeGreaterThan(0);
    expect(segs.length / 4).toBeLessThanOrEqual(SPEED_STREAKS.HIGH);
    const reach = Math.hypot(640, 720 - 252) * 1.05;
    for (let k = 0; k < segs.length; k += 4) {
      const r = Math.hypot((segs[k] as number) - 640, (segs[k + 1] as number) - 252);
      expect(r).toBeGreaterThanOrEqual(reach * 0.45 - 1e-6);
    }
    const ctx = ctx2d();
    drawSpeedStreaks(ctx, segs, 1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });
});

describe('nuvens baixas', () => {
  const cam = makeCamera(1280, 720, 0, 100, 'HIGH');

  it('fixas no mundo: andar faz a mesma nuvem chegar mais perto e crescer', () => {
    const a = buildWisps(1000, 100, cam, 'HIGH');
    const b = buildWisps(1010, 100, cam, 'HIGH');
    expect(a.length).toBeGreaterThan(0);
    expect(buildWisps(1000, 100, cam, 'HIGH')).toEqual(a);
    const biggest = (w: typeof a) => Math.max(...w.map((x) => x.w));
    expect(biggest(b)).toBeGreaterThanOrEqual(biggest(a) * 0.99);
  });

  it('acima da aeronave (no alto da tela), translúcidas, e somem de perto', () => {
    for (let s = 0; s < 2000; s += 37) {
      for (const w of buildWisps(s, 100, cam, 'MEDIUM')) {
        expect(w.y).toBeLessThan(cam.horizonY + 40);
        expect(w.alpha).toBeGreaterThan(0);
        expect(w.alpha).toBeLessThanOrEqual(0.5);
        // Perto da distância mínima, a nuvem já está quase transparente.
        expect(w.w).toBeLessThan((90 * cam.focalPx) / WISP_NEAR_DEPTH_M);
      }
    }
    const ctx = ctx2d();
    drawWisps(ctx, buildWisps(1000, 100, cam, 'HIGH'));
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});
