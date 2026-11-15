/**
 * RIFT_POLAR_BASE — R07 "Base Polar das Sombras" (terrain §3): planície nevada de 15 m de relevo
 * (fbm), com um complexo militar nivelado no meio: pátio cercado, quatro torres de vigia nos
 * cantos (cada uma com um holofote que varre o chão), hangares e galpões e o andador bípede
 * gigante (25 m) parado no centro. Uma estrada de serviço contorna o complexo. As cores de bioma
 * são exceção aos tokens (ui-style §1).
 */
import { clamp, smoothstep } from '@/lib/math';
import type { AoiPoint, FeatureTarget, Rgb, SpecialZone, WorldObject } from '@/types';
import type { NoiseKit } from '../noise';
import { makeObject } from '../objects';
import { MARGIN_FRACTION, type BiomeRecipe, type Polyline } from '../TerrainSampler';

export const RELIEF_M = 15;
const RELIEF_SCALE_M = 140;

/** O pátio cercado: 120 × 100 m, com o andador no centro. */
export const YARD = { uMin: 90, uMax: 210, vMin: 70, vMax: 170 } as const;
/** Rampa de nivelamento do complexo: 1 dentro do retângulo, 0 a 15 m dele. */
const PAD = { uMin: 40, uMax: 260, vMin: 30, vMax: 210 } as const;
const PAD_FADE_M = 15;

/** O andador bípede gigante, parado no centro do pátio, e o alvo `WALKER` em volta dele. */
export const WALKER_AT: AoiPoint = { u: 150, v: 120 };
export const WALKER = { widthM: 16, depthM: 12, heightM: 25 } as const;
export const WALKER_FEATURE: FeatureTarget = {
  id: 'WALKER',
  name: 'Andador gigante',
  u: 150,
  v: 120,
  radiusM: 15,
  needs: 'PHOTO',
};

/** Quatro torres de vigia nos cantos do pátio, cada uma com seu holofote (r = 15 m). */
export const TOWERS: readonly AoiPoint[] = [
  { u: YARD.uMin, v: YARD.vMin },
  { u: YARD.uMax, v: YARD.vMin },
  { u: YARD.uMin, v: YARD.vMax },
  { u: YARD.uMax, v: YARD.vMax },
];
export const TOWER = { widthM: 4, depthM: 4, heightM: 20 } as const;
export const SEARCHLIGHT_RADIUS_M = 15;
export const SEARCHLIGHT_SWEEP_RAD = Math.PI / 2;
export const SEARCHLIGHT_PERIOD_S = [6, 9] as const;

/** Hangares (grandes) e galpões (pequenos): fora do pátio e dentro dele. */
export const HANGARS: ReadonlyArray<{ u: number; v: number; widthM: number; depthM: number }> = [
  { u: 60, v: 45, widthM: 36, depthM: 22 },
  { u: 60, v: 195, widthM: 36, depthM: 22 },
  { u: 245, v: 45, widthM: 36, depthM: 22 },
  { u: 245, v: 195, widthM: 36, depthM: 22 },
];
export const SHEDS: ReadonlyArray<{ u: number; v: number }> = [
  { u: 108, v: 150 },
  { u: 192, v: 90 },
];
export const HANGAR_HEIGHT_M = 10;
export const SHED_HEIGHT_M = 5;

/** Cerca do pátio: um poste a cada 10 m, com tela de arame entre eles (2,5 m). */
export const FENCE_POST_SPACING_M = 10;
export const FENCE_HEIGHT_M = 2.5;

const HANGAR_COLOR: Rgb = [150, 160, 178];
const SHED_COLOR: Rgb = [178, 152, 132];
const TOWER_COLOR: Rgb = [124, 130, 142];
const WALKER_COLOR: Rgb = [136, 148, 162];
const FENCE_COLOR: Rgb = [90, 96, 108];

/** Relevo nevado, sem o nivelamento do complexo. */
function groundAt(u: number, v: number, n: NoiseKit): number {
  const wave = n.fbm(n.a, u / RELIEF_SCALE_M, v / RELIEF_SCALE_M, { octaves: 2 });
  return RELIEF_M / 2 + (RELIEF_M / 2) * clamp(1.2 * wave, -1, 1);
}

function padWeight(u: number, v: number): number {
  const du = Math.max(PAD.uMin - u, 0, u - PAD.uMax);
  const dv = Math.max(PAD.vMin - v, 0, v - PAD.vMax);
  const d = Math.hypot(du, dv);
  return d >= PAD_FADE_M ? 0 : 1 - smoothstep(0, PAD_FADE_M, d);
}

/** A estrada de serviço: um anel em volta do complexo e o acesso pelo oeste. */
const ROAD_WIDTH_M = 8;
const RING = { uMin: 30, uMax: 270, vMin: 20, vMax: 220 } as const;

export const RIFT_POLAR_BASE: BiomeRecipe = {
  id: 'RIFT_POLAR_BASE',
  palette: {
    cover: {
      GRASS: [200, 214, 214],
      CROP: [208, 218, 214],
      FOREST: [150, 176, 176],
      WATER: [150, 190, 220],
      ROAD: [186, 194, 206],
      ROOF: [148, 158, 176],
      SAND: [226, 224, 214],
      ROCK: [170, 176, 186],
      SWAMP: [190, 204, 204],
      URBAN: [196, 202, 212],
      BENCH: [182, 188, 198],
      LAVA: [244, 104, 42],
      SNOW: [238, 246, 252],
      METAL: [140, 150, 164],
    },
    skyTop: [170, 188, 208],
    skyHorizon: [230, 238, 246],
    fog: [218, 230, 242],
    water: [150, 190, 220],
  },

  // Planície ondulada de 0–15 m com o complexo nivelado na cota do centro do pátio.
  baseElevation(u, v, n) {
    const e = groundAt(u, v, n);
    const t = padWeight(u, v);
    if (t <= 0) return e;
    return e + (groundAt(WALKER_AT.u, WALKER_AT.v, n) - e) * t;
  },

  // Neve em tudo; os telhados (ROOF) e a estrada (ROAD) vêm do sampler.
  landCover() {
    return 'SNOW';
  },

  canopy() {
    return 0;
  },

  ndvi(_u, _v, cover) {
    return cover === 'ROOF' || cover === 'ROAD' ? 0.04 : 0.02;
  },

  roads(aoi) {
    const m = MARGIN_FRACTION;
    const vMid = aoi.widthM / 2;
    const ring: Polyline = {
      kind: 'ROAD',
      widthM: ROAD_WIDTH_M,
      points: [
        { u: RING.uMin, v: RING.vMin },
        { u: RING.uMax, v: RING.vMin },
        { u: RING.uMax, v: RING.vMax },
        { u: RING.uMin, v: RING.vMax },
        { u: RING.uMin, v: RING.vMin },
      ],
    };
    const access: Polyline = {
      kind: 'ROAD',
      widthM: ROAD_WIDTH_M,
      points: [
        { u: -m * aoi.lengthM, v: vMid },
        { u: RING.uMin, v: vMid },
      ],
    };
    return [ring, access];
  },

  features() {
    return [{ ...WALKER_FEATURE }];
  },

  placeObjects(ctx) {
    const objects: WorldObject[] = [];

    // O andador gigante, parado no centro do pátio.
    objects.push(
      makeObject(ctx.nextId, {
        kind: 'GIANT_WALKER',
        u: WALKER_AT.u,
        v: WALKER_AT.v,
        widthM: WALKER.widthM,
        depthM: WALKER.depthM,
        heightM: WALKER.heightM,
        color: WALKER_COLOR,
      }),
    );

    // Hangares fora do pátio e galpões dentro dele.
    for (const h of HANGARS) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BUILDING',
          u: h.u,
          v: h.v,
          widthM: h.widthM,
          depthM: h.depthM,
          heightM: HANGAR_HEIGHT_M,
          color: HANGAR_COLOR,
        }),
      );
    }
    for (const s of SHEDS) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'BUILDING',
          u: s.u,
          v: s.v,
          widthM: 12,
          depthM: 8,
          heightM: SHED_HEIGHT_M,
          color: SHED_COLOR,
        }),
      );
    }

    // Torres de vigia nos quatro cantos do pátio.
    for (const t of TOWERS) {
      objects.push(
        makeObject(ctx.nextId, {
          kind: 'TOWER',
          u: t.u,
          v: t.v,
          widthM: TOWER.widthM,
          depthM: TOWER.depthM,
          heightM: TOWER.heightM,
          color: TOWER_COLOR,
        }),
      );
    }

    // Cerca em volta do pátio: postes de 10 em 10 m com tela entre eles.
    const corners: AoiPoint[] = [
      { u: YARD.uMin, v: YARD.vMin },
      { u: YARD.uMax, v: YARD.vMin },
      { u: YARD.uMax, v: YARD.vMax },
      { u: YARD.uMin, v: YARD.vMax },
    ];
    for (let side = 0; side < corners.length; side++) {
      const a = corners[side] as AoiPoint;
      const b = corners[(side + 1) % corners.length] as AoiPoint;
      const len = Math.hypot(b.u - a.u, b.v - a.v);
      const steps = Math.round(len / FENCE_POST_SPACING_M);
      for (let k = 0; k < steps; k++) {
        const p0 = { u: a.u + ((b.u - a.u) * k) / steps, v: a.v + ((b.v - a.v) * k) / steps };
        const p1 = {
          u: a.u + ((b.u - a.u) * (k + 1)) / steps,
          v: a.v + ((b.v - a.v) * (k + 1)) / steps,
        };
        // O poste do canto é a torre de vigia.
        if (k > 0) {
          objects.push(
            makeObject(ctx.nextId, {
              kind: 'POLE',
              u: p0.u,
              v: p0.v,
              widthM: 0.3,
              depthM: 0.3,
              heightM: FENCE_HEIGHT_M + 0.5,
              color: FENCE_COLOR,
              solid: false,
            }),
          );
        }
        objects.push(
          makeObject(ctx.nextId, {
            kind: 'WIRE',
            u: p0.u,
            v: p0.v,
            u2: p1.u,
            v2: p1.v,
            widthM: 0.1,
            depthM: Math.hypot(p1.u - p0.u, p1.v - p0.v),
            heightM: FENCE_HEIGHT_M,
            baseM: FENCE_HEIGHT_M,
            color: FENCE_COLOR,
          }),
        );
      }
    }
    return objects;
  },

  // Um holofote em cada torre: a mancha de luz (35 % do raio) gira em arco de 90° a cada 6–9 s.
  zones(_objects, _aoi, rng) {
    return TOWERS.map<SpecialZone>((t) => ({
      kind: 'SEARCHLIGHT',
      u: t.u,
      v: t.v,
      radiusM: SEARCHLIGHT_RADIUS_M,
      sweepRad: SEARCHLIGHT_SWEEP_RAD,
      periodS: rng.range(...SEARCHLIGHT_PERIOD_S),
    }));
  },

  // A estrada de serviço é chão firme em volta do complexo.
  guaranteedAccessible: [{ u: 30, v: 120 }],
};
