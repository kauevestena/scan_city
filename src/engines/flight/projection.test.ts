import type { FlightLine } from '@/types';
import {
  CAM_ALT_MAX_LAG_M,
  CAM_ALT_TAU_S,
  CAMERA_OFFSET_M,
  followCameraAlt,
  halfWidthAt,
  makeCamera,
  project,
  projectAbs,
  QUALITY,
  unprojectGround,
} from './projection';
import { aoiPoint, runFrame, toRun } from './runFrame';

const line = (start: { u: number; v: number }, end: { u: number; v: number }): FlightLine => ({
  index: 0,
  pass: 'PRIMARY',
  start,
  end,
  aoiStartS: 30,
  aoiEndS: 270,
  direction: 1,
});

describe('frame do run (§5.2)', () => {
  it('linha para +u: X positivo à direita (+v, sul)', () => {
    const f = runFrame(line({ u: -30, v: 20 }, { u: 270, v: 20 }));
    expect(f.lengthM).toBe(300);
    expect(f.right).toEqual({ u: -0, v: 1 });
    expect(aoiPoint(f, 30, 5)).toEqual({ u: 0, v: 25 });
    expect(f.headingRad).toBe(0);
  });

  it('linha de volta (−u): a direita é o norte; ida e volta com toRun', () => {
    const f = runFrame(line({ u: 270, v: 50 }, { u: -30, v: 50 }));
    expect(f.right.v).toBe(-1);
    const p = aoiPoint(f, 100, -7);
    expect(p).toEqual({ u: 170, v: 57 });
    expect(toRun(f, p)).toEqual({ s: 100, x: -7 });
    // Linha degenerada: direção padrão +u.
    expect(runFrame(line({ u: 0, v: 0 }, { u: 0, v: 0 })).dir).toEqual({ u: 1, v: 0 });
  });
});

describe('projeção (§5.1)', () => {
  const cam = makeCamera(1280, 720, 0, 100);

  it('FOV de 70°, horizonte em 0,35·H, câmera 12 m acima da aeronave', () => {
    expect(cam.focalPx).toBeCloseTo(640 / Math.tan((35 * Math.PI) / 180), 9);
    expect(cam.horizonY).toBeCloseTo(252, 9);
    expect(cam.camAlt).toBe(112);
    expect(makeCamera(1280, 720, 0, 0, 'LOW').zFar).toBe(QUALITY.LOW.zFar);
  });

  it('scale = focal/(Z + 30); X à direita, altura menor fica mais abaixo', () => {
    const p = projectAbs(10, 0, 70, cam);
    expect(p?.scale).toBeCloseTo(cam.focalPx / 100, 9);
    expect(p?.x).toBeCloseTo(640 + 10 * (cam.focalPx / 100), 9);
    expect(p?.y).toBeCloseTo(252 + 112 * (cam.focalPx / 100), 9);
    // Mais longe: mais perto do horizonte.
    expect((projectAbs(0, 0, 500, cam)?.y ?? 0) < (p?.y ?? 0)).toBe(true);
    expect(projectAbs(0, 0, -CAMERA_OFFSET_M, cam)).toBeNull();
    expect(project(0, 5, 70, cam, () => 10)).toEqual(projectAbs(0, 15, 70, cam));
  });

  it('unprojectGround inverte a projeção no chão', () => {
    const elev = (X: number, Z: number) => 3 + 0.02 * Z + 0.01 * X;
    const target = projectAbs(12, elev(12, 240), 240, cam);
    if (!target) throw new Error('fora');
    const hit = unprojectGround(target.x, target.y, cam, elev);
    expect(hit?.Z).toBeCloseTo(240, 3);
    expect(hit?.X).toBeCloseTo(12, 3);
    expect(unprojectGround(640, 10, cam, elev)).toBeNull();
    expect(halfWidthAt(70, cam)).toBeCloseTo(680 / (cam.focalPx / 100), 9);
  });
});

describe('a câmera segue a altitude com atraso (ADR-035)', () => {
  it('sem anterior, a da aeronave; subindo, fica para trás e a aeronave sobe na tela', () => {
    expect(followCameraAlt(null, 60, 0.016)).toBe(60);
    // Um passo de 1/60 s com a aeronave 2 m acima: a câmera anda só uma fração.
    const cam = followCameraAlt(60, 62, 1 / 60);
    expect(cam).toBeGreaterThan(60);
    expect(cam).toBeLessThan(61);
    // Depois de alguns tempos de resposta, alcança.
    let c = 60;
    for (let k = 0; k < 120; k++) c = followCameraAlt(c, 62, 1 / 60);
    expect(c).toBeCloseTo(62, 1);
  });

  it('nunca fica mais longe que o atraso máximo (a decolagem sobe rápido)', () => {
    expect(followCameraAlt(0, 100, 1 / 60)).toBe(100 - CAM_ALT_MAX_LAG_M);
    expect(followCameraAlt(200, 100, 1 / 60)).toBe(100 + CAM_ALT_MAX_LAG_M);
    expect(CAM_ALT_TAU_S).toBeGreaterThan(0);
  });

  it('com a câmera atrasada, a aeronave sobe no quadro em relação ao ponto de descanso', () => {
    const rest = makeCamera(1280, 720, 0, 60);
    const lagging = makeCamera(1280, 720, 0, 60 - 2);
    const at = (cam: typeof rest) => projectAbs(0, 60, 0, cam)?.y ?? 0;
    expect(at(lagging)).toBeLessThan(at(rest));
  });
});
