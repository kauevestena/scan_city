import type { WorldObject } from '@/types';
import { makeObject } from '@/world/terrain/objects';
import {
  checkCollision,
  distanceToSegment,
  hitsObject,
  hitsTerrain,
  isBeamOn,
  mayTouch,
  motionOffset,
} from './collision';
import { mulberry32 } from '@/lib/rng';
import { crashPose, CRASH_S, invulnerableAlpha, shakeOffset } from './effects';

let id = 0;
const next = () => ++id;
const obj = (spec: Partial<WorldObject> & Pick<WorldObject, 'kind'>): WorldObject =>
  makeObject(next, { u: 0, v: 0, widthM: 10, depthM: 10, heightM: 20, color: [1, 2, 3], ...spec });
const flat = () => 0;
const at = (u: number, v: number, alt: number, radiusM = 0.5) => ({ u, v, alt, radiusM });

describe('caixa (BUILDING e afins), com rotação', () => {
  const b = obj({ kind: 'BUILDING', widthM: 10, depthM: 4, heightM: 30 });

  it('dentro, e a 30 m de altura do prédio de 30 m: bate até o topo + raio', () => {
    expect(hitsObject(at(0, 0, 20), b, 0, flat)).toBe(true);
    expect(hitsObject(at(0, 0, 30.4), b, 0, flat)).toBe(true);
    expect(hitsObject(at(0, 0, 31), b, 0, flat)).toBe(false);
    expect(hitsObject(at(5.4, 0, 10), b, 0, flat)).toBe(true);
    expect(hitsObject(at(6, 0, 10), b, 0, flat)).toBe(false);
  });

  it('rotacionada em 90°: a largura passa para o eixo v', () => {
    const rot = { ...b, rotationRad: Math.PI / 2 };
    expect(hitsObject(at(0, 4.9, 10), rot, 0, flat)).toBe(true);
    expect(hitsObject(at(4.9, 0, 10), rot, 0, flat)).toBe(false);
  });

  it('segue o terreno e respeita a base flutuante', () => {
    const floating = { ...b, baseM: 40 };
    expect(hitsObject(at(0, 0, 20), floating, 0, flat)).toBe(false);
    expect(hitsObject(at(0, 0, 45), floating, 0, flat)).toBe(true);
    expect(hitsObject(at(0, 0, 105), b, 0, () => 100)).toBe(true);
    expect(hitsObject(at(0, 0, 20), { ...b, solid: false }, 0, flat)).toBe(false);
  });
});

describe('árvore: tronco + copa', () => {
  const tree = obj({ kind: 'TREE', widthM: 6, depthM: 6, heightM: 10 });
  it('copa esférica no topo; tronco fino embaixo', () => {
    expect(hitsObject(at(2.5, 0, 7), tree, 0, flat)).toBe(true);
    expect(hitsObject(at(0, 0, 9.5), tree, 0, flat)).toBe(true);
    expect(hitsObject(at(2.5, 0, 1), tree, 0, flat)).toBe(false);
    expect(hitsObject(at(0.5, 0, 1), tree, 0, flat)).toBe(true);
    expect(hitsObject(at(0, 0, 14), tree, 0, flat)).toBe(false);
  });
});

describe('cilindros: PIPE e POLE', () => {
  it('PIPE usa a largura como diâmetro; POLE tem raio fixo de 0,3', () => {
    const pipe = obj({ kind: 'PIPE', widthM: 4, heightM: 15 });
    expect(hitsObject(at(2.4, 0, 5), pipe, 0, flat)).toBe(true);
    expect(hitsObject(at(3, 0, 5), pipe, 0, flat)).toBe(false);
    expect(hitsObject(at(0, 0, 16), pipe, 0, flat)).toBe(false);
    const pole = obj({ kind: 'POLE', widthM: 0.3, heightM: 8 });
    expect(hitsObject(at(0.7, 0, 4), pole, 0, flat)).toBe(true);
    expect(hitsObject(at(1.0, 0, 4), pole, 0, flat)).toBe(false);
  });
});

describe('fio: segmento com raio de 0,5 m', () => {
  const wire = obj({
    kind: 'WIRE',
    u: 0,
    v: 0,
    u2: 30,
    v2: 0,
    baseM: 10,
    heightM: 10,
    widthM: 0.1,
    depthM: 0.1,
  });
  it('toca a ±1 m (0,5 + raio) da altura entre os postes; fora do segmento não', () => {
    expect(hitsObject(at(15, 0, 10), wire, 0, flat)).toBe(true);
    expect(hitsObject(at(15, 0, 10.9), wire, 0, flat)).toBe(true);
    expect(hitsObject(at(15, 0, 12), wire, 0, flat)).toBe(false);
    expect(hitsObject(at(15, 3, 10), wire, 0, flat)).toBe(false);
    expect(hitsObject(at(40, 0, 10), wire, 0, flat)).toBe(false);
    expect(distanceToSegment([0, 0, 0], [0, 0, 0], [0, 0, 0])).toBe(0);
  });
});

describe('arco de pedra: vão livre', () => {
  const arch = obj({ kind: 'STONE_ARCH', widthM: 20, depthM: 4, heightM: 15 });
  it('colunas e viga sólidas; o vão embaixo da viga é livre', () => {
    expect(hitsObject(at(-9, 0, 5), arch, 0, flat)).toBe(true);
    expect(hitsObject(at(9, 0, 5), arch, 0, flat)).toBe(true);
    expect(hitsObject(at(0, 0, 14), arch, 0, flat)).toBe(true);
    expect(hitsObject(at(0, 0, 5), arch, 0, flat)).toBe(false);
    expect(hitsObject(at(0, 0, 17), arch, 0, flat)).toBe(false);
  });
});

describe('feixe de energia, ligado e desligado', () => {
  const beam = obj({
    kind: 'ENERGY_BEAM',
    widthM: 4,
    heightM: 30,
    activePeriod: { onS: 2, offS: 3, phase: 0 },
  });
  it('2 s ligado e 3 s desligado, com fase', () => {
    expect([0, 1.9, 2.1, 4.9, 5.1].map((t) => isBeamOn(beam, t))).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
    expect(isBeamOn({ activePeriod: { onS: 2, offS: 3, phase: 2 } }, 0)).toBe(false);
    expect(isBeamOn({}, 99)).toBe(true);
    expect(hitsObject(at(1, 0, 10), beam, 1, flat)).toBe(true);
    expect(hitsObject(at(1, 0, 10), beam, 3, flat)).toBe(false);
  });
});

describe('perigo móvel: esfera senoidal', () => {
  const hazard = obj({
    kind: 'MOVING_HAZARD',
    widthM: 6,
    heightM: 6,
    baseM: 10,
    motion: { axis: 'u', amplitudeM: 20, periodS: 4, phase: 0 },
  });
  it('a esfera acompanha o deslocamento em t', () => {
    expect(motionOffset(hazard, 1)).toEqual({ du: expect.closeTo(20, 9), dv: 0, dh: 0 });
    expect(motionOffset({}, 1)).toEqual({ du: 0, dv: 0, dh: 0 });
    expect(hitsObject(at(0, 0, 13), hazard, 0, flat)).toBe(true);
    expect(hitsObject(at(0, 0, 13), hazard, 1, flat)).toBe(false);
    expect(hitsObject(at(20, 0, 13), hazard, 1, flat)).toBe(true);
    const vertical = {
      ...hazard,
      motion: { axis: 'h' as const, amplitudeM: 20, periodS: 4, phase: 0 },
    };
    expect(hitsObject(at(0, 0, 33), vertical, 1, flat)).toBe(true);
  });
});

describe('objetos não sólidos e queda no terreno', () => {
  it('anel, holofote e alvo não colidem', () => {
    for (const kind of ['RING', 'SEARCHLIGHT', 'GCP_TARGET'] as const) {
      expect(hitsObject(at(0, 0, 10), obj({ kind }), 0, flat)).toBe(false);
    }
  });

  it('checkCollision devolve o primeiro tocado; hitsTerrain: alt < elevação + raio', () => {
    const a = obj({ kind: 'BUILDING', u: 100 });
    const b = obj({ kind: 'BUILDING', u: 0 });
    expect(checkCollision(at(0, 0, 10), [a, b], 0, flat)).toBe(b);
    expect(checkCollision(at(50, 0, 10), [a, b], 0, flat)).toBeNull();
    expect(hitsTerrain(at(0, 0, 0.4), flat)).toBe(true);
    expect(hitsTerrain(at(0, 0, 0.6), flat)).toBe(false);
    expect(hitsTerrain(at(0, 0, 100.4), () => 100)).toBe(true);
  });
});

describe('efeitos', () => {
  it('shake de 0,3 s a 8 px, desligado com reduceFlashes', () => {
    const s = shakeOffset(0.3, 0.1, false);
    expect(Math.hypot(s.x, s.y)).toBeGreaterThan(0);
    expect(Math.abs(s.x)).toBeLessThanOrEqual(8);
    expect(shakeOffset(0, 0.1, false)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(0.3, 0.1, true)).toEqual({ x: 0, y: 0 });
  });

  it('invulnerável pisca; com reduceFlashes fica translúcida', () => {
    expect(invulnerableAlpha(0, false)).toBe(1);
    expect(new Set([1.4, 1.3, 1.2, 1.1].map((t) => invulnerableAlpha(t, false)))).toEqual(
      new Set([0.25, 1]),
    );
    expect(invulnerableAlpha(1, true)).toBe(0.5);
  });

  it('queda de 2 s: gira, cai e solta fumaça', () => {
    expect(crashPose(0)).toEqual({ spin: 0, fall: 0, smoke: 0 });
    const end = crashPose(CRASH_S);
    expect(end.fall).toBe(1);
    expect(end.smoke).toBe(1);
    expect(end.spin).toBeCloseTo(6 * Math.PI, 9);
    expect(crashPose(CRASH_S / 2).fall).toBeCloseTo(0.25, 9);
  });
});

describe('Atlas: sem custo de reparo', () => {
  it('o preço do Atlas é zero, então a penalidade `quedas × preço × reparo` também', async () => {
    const { getAircraft } = await import('@/data/catalog');
    const atlas = getAircraft('ATLAS');
    expect(Math.round((3 * atlas.priceBRL * atlas.repairCostPct) / 100)).toBe(0);
    const t1 = getAircraft('DRONE_T1');
    expect(Math.round((1 * t1.priceBRL * t1.repairCostPct) / 100)).toBeGreaterThan(0);
  });
});

describe('filtro no plano (mayTouch) antes da colisão exata', () => {
  it('nunca descarta um objeto que colide, em 20 mil corpos sorteados perto de cada forma', () => {
    const rng = mulberry32(31);
    const shapes: WorldObject[] = [
      obj({ kind: 'BUILDING', rotationRad: 0.7, widthM: 12, depthM: 6 }),
      obj({ kind: 'CUBE_BLOCK', widthM: 4, depthM: 4, heightM: 4 }),
      obj({ kind: 'TREE', widthM: 8, heightM: 18 }),
      obj({ kind: 'POLE', heightM: 10 }),
      obj({ kind: 'PIPE', widthM: 3, heightM: 12 }),
      obj({ kind: 'STONE_ARCH', widthM: 20, depthM: 4, heightM: 15, rotationRad: 1.1 }),
      obj({ kind: 'WIRE', u2: 35, v2: 12, baseM: 10, heightM: 10 }),
      obj({
        kind: 'MOVING_HAZARD',
        widthM: 6,
        baseM: 5,
        heightM: 6,
        motion: { axis: 'u', amplitudeM: 15, periodS: 4, phase: 0 },
      }),
    ];
    let hits = 0;
    for (const o of shapes) {
      for (let k = 0; k < 2500; k++) {
        const body = at(
          rng.range(-30, 45),
          rng.range(-30, 30),
          rng.range(0, 25),
          rng.range(0.3, 1.5),
        );
        const t = rng.range(0, 10);
        if (hitsObject(body, o, t, flat)) {
          hits++;
          expect(mayTouch(body, o), `${o.kind} em ${JSON.stringify(body)}`).toBe(true);
        }
      }
    }
    // O teste só vale se houve colisões de verdade a conferir.
    expect(hits).toBeGreaterThan(100);
  });

  it('descarta o que está longe no plano e o que não é sólido', () => {
    expect(mayTouch(at(100, 0, 5), obj({ kind: 'BUILDING' }))).toBe(false);
    expect(mayTouch(at(0, 0, 5), obj({ kind: 'RING', solid: false }))).toBe(false);
    expect(mayTouch(at(5, 0, 5), obj({ kind: 'BUILDING' }))).toBe(true);
  });
});
