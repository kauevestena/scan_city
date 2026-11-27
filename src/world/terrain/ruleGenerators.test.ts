import { mulberry32 } from '@/lib/rng';
import type { AoiPoint, WorldObject } from '@/types';
import { lavaThermalZones, lowWireLine, rtkCanyonZones, trenchElevation } from './ruleGenerators';
import { makeObject, objectIdFactory } from './objects';

const building = (u: number, v: number, h: number, w = 20, d = 20): WorldObject =>
  makeObject(objectIdFactory(), {
    kind: 'BUILDING',
    u,
    v,
    widthM: w,
    depthM: d,
    heightM: h,
    color: [150, 150, 150],
  });

describe('rtkCanyonZones', () => {
  it('sem prédios altos, ou com um só, não há cânion', () => {
    expect(rtkCanyonZones([])).toEqual([]);
    expect(rtkCanyonZones([building(100, 80, 90)])).toEqual([]);
    expect(rtkCanyonZones([building(100, 80, 45), building(130, 80, 45)])).toEqual([]); // 45 não é > 45
  });

  it('só prédios > 45 m contam, e o vão entre pegadas define o cânion (< 40 m)', () => {
    const near = rtkCanyonZones([building(100, 80, 70), building(139, 80, 90)]); // vão de 19 m
    expect(near).toEqual([{ kind: 'RTK_CANYON', uMin: 90, uMax: 149, vMin: 70, vMax: 90 }]);
    // Vão de exatamente 40 m: não é cânion.
    expect(rtkCanyonZones([building(100, 80, 70), building(160, 80, 90)])).toEqual([]);
    // Um dos dois é baixo: não forma cânion.
    expect(rtkCanyonZones([building(100, 80, 70), building(139, 80, 30)])).toEqual([]);
  });

  it('o vão diagonal usa a distância euclidiana entre as pegadas', () => {
    // Vãos de 25 m em u e 25 m em v: hipotenusa ≈ 35,4 m < 40 → cânion.
    expect(rtkCanyonZones([building(100, 80, 70), building(145, 125, 70)])).toHaveLength(1);
    // Vãos de 30 m em u e 30 m em v: ≈ 42,4 m → não.
    expect(rtkCanyonZones([building(100, 80, 70), building(150, 130, 70)])).toHaveLength(0);
  });

  it('a elevação-base (baseM) conta para a altura do prédio', () => {
    const onHill = { ...building(100, 80, 30), baseM: 40 };
    expect(rtkCanyonZones([onHill, building(139, 80, 70)])).toHaveLength(1);
  });

  it('vários prédios: um cânion por par vizinho (vão de 15 m); o vizinho do vizinho (50 m) não conta', () => {
    const row = [0, 1, 2, 3].map((k) => building(100 + k * 35, 80, 80));
    const zones = rtkCanyonZones(row);
    expect(zones.map((z) => [z.uMin, z.uMax])).toEqual([
      [90, 145],
      [125, 180],
      [160, 215],
    ]);
  });
});

describe('lavaThermalZones', () => {
  it('sem lava, sem térmicas; células da mesma casa de 40 m dividem a térmica no centroide', () => {
    expect(lavaThermalZones([])).toEqual([]);
    const cells: AoiPoint[] = [
      { u: 100, v: 100 },
      { u: 110, v: 108 },
      { u: 90, v: 92 },
    ];
    expect(lavaThermalZones(cells)).toEqual([
      { kind: 'THERMAL', u: 100, v: 100, radiusM: 40, liftMs: 6 },
    ]);
  });

  it('casas diferentes geram térmicas diferentes, com parâmetros customizáveis', () => {
    const zones = lavaThermalZones(
      [
        { u: 10, v: 10 },
        { u: 100, v: 10 },
      ],
      { liftMs: 4, radiusM: 25 },
    );
    expect(zones).toEqual([
      { kind: 'THERMAL', u: 10, v: 10, radiusM: 25, liftMs: 4 },
      { kind: 'THERMAL', u: 100, v: 10, radiusM: 25, liftMs: 4 },
    ]);
  });
});

describe('trenchElevation', () => {
  it('−40 m dentro da faixa de 50 m, 0 fora; a borda exata fica fora', () => {
    expect(trenchElevation(60, 60)).toBe(-40);
    expect(trenchElevation(35.01, 60)).toBe(-40);
    expect(trenchElevation(35, 60)).toBe(0);
    expect(trenchElevation(85, 60)).toBe(0);
    expect(trenchElevation(0, 60)).toBe(0);
    expect(trenchElevation(10, 10, { widthM: 10, depthM: 5 })).toBe(-5);
  });
});

describe('lowWireLine', () => {
  const line: AoiPoint[] = [
    { u: 20, v: 60 },
    { u: 220, v: 60 },
  ];

  it('polilinha vazia não gera nada; de um ponto, só o poste inicial e nenhum fio', () => {
    expect(lowWireLine([], mulberry32(1), objectIdFactory())).toEqual({ poles: [], wires: [] });
    const single = lowWireLine([{ u: 5, v: 5 }], mulberry32(1), objectIdFactory());
    expect(single.poles.map((p) => [p.kind, p.u, p.v])).toEqual([['POLE', 5, 5]]);
    expect(single.wires).toEqual([]);
  });

  it('é determinístico para a mesma semente e muda com outra', () => {
    const run = (seed: number) => lowWireLine(line, mulberry32(seed), objectIdFactory());
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
  });

  it('percorre uma polilinha com curva: espaçamento 30–40 m entre postes, fios entre pares', () => {
    const bent: AoiPoint[] = [
      { u: 20, v: 20 },
      { u: 120, v: 20 },
      { u: 120, v: 120 },
    ];
    const { poles, wires } = lowWireLine(bent, mulberry32(9), objectIdFactory());
    expect(poles.length).toBeGreaterThanOrEqual(5);
    expect(wires).toHaveLength(poles.length - 1);
    // Cada fio liga postes consecutivos.
    for (const [k, w] of wires.entries()) {
      const a = poles[k] as WorldObject;
      const b = poles[k + 1] as WorldObject;
      expect([w.u, w.v, w.u2, w.v2]).toEqual([a.u, a.v, b.u, b.v]);
      expect(w.depthM).toBeCloseTo(Math.hypot(b.u - a.u, b.v - a.v), 9);
    }
    // Todos os ids são distintos.
    const ids = [...poles, ...wires].map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
