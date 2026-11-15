import * as lucide from 'lucide-react';
import { COSMETICS, EMBLEM_PALETTE, STARTING_COSMETICS } from '@/data/cosmetics';
import { SKILLS } from '@/data/skills';
import { SOUVENIRS } from '@/data/souvenirs';
import { initialInventory } from '@/state/slices/inventorySlice';
import type { UnlockCondition } from '@/types';
import { hasIcon } from '@/ui/iconRegistry';
import {
  AIRCRAFT,
  ALL_ITEM_IDS,
  ATLAS_RULES,
  brl,
  CATALOG,
  FIELD_EQUIPMENT,
  getAircraft,
  getFieldEquipment,
  getHardware,
  getLens,
  getPayload,
  getSensor,
  getStaffRole,
  getVehicle,
  HARDWARE,
  LENSES,
  PAYLOADS,
  POINT_LIMITS,
  PURCHASABLE_SENSORS,
  PURCHASE_PREREQUISITES,
  SENSORS,
  STAFF,
  T2_COMBO_ITEMS,
  VEHICLES,
} from './index';

const CONTRACT_IDS = [
  ...Array.from({ length: 7 }, (_, i) => `C0${i}`),
  ...Array.from({ length: 11 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`),
];

const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;

describe('IDs', () => {
  it('são únicos em todo o catálogo e em cada coleção', () => {
    const items = [
      ...SENSORS,
      ...LENSES,
      ...PAYLOADS,
      ...AIRCRAFT,
      ...VEHICLES,
      ...FIELD_EQUIPMENT,
      ...HARDWARE,
    ].map((i) => i.id);
    expect(unique(items)).toBe(true);
    expect(ALL_ITEM_IDS.size).toBe(items.length);
    expect(unique(STAFF.map((s) => s.id))).toBe(true);
    expect(unique(SKILLS.map((s) => s.id))).toBe(true);
    expect(unique(COSMETICS.map((c) => c.id))).toBe(true);
    expect(unique(SOUVENIRS.map((s) => s.id))).toBe(true);
  });

  it('as consultas por id acham os itens e rejeitam ids desconhecidos', () => {
    expect(getSensor('CAM_PIGEON').name).toBe('Câmera de Peito do Avô');
    expect(getLens('LENS_24').equivFocalMm).toBe(24);
    expect(getPayload('POD_LIDAR').prrHz).toBe(240_000);
    expect(getAircraft('VTOL_T3').turnRadiusM).toBe(80);
    expect(getVehicle('LAB_VAN').fieldSpeedFactor).toBe(2.5);
    expect(getFieldEquipment('TOTAL_STATION').maxPoints).toBe(8);
    expect(getHardware('CLOUD').speedFactor).toBe(15);
    expect(getStaffRole('JUNIOR_ENG').maxCount).toBe(2);
    expect(() => getSensor('CAM_NOPE')).toThrow(RangeError);
    expect(CATALOG.aircraft).toBe(AIRCRAFT);
  });
});

describe('referências cruzadas', () => {
  it('câmeras ↔ aeronaves são compatíveis nos dois sentidos', () => {
    for (const sensor of SENSORS) {
      for (const aircraftId of sensor.compatibleAircraft) {
        expect(getAircraft(aircraftId).compatibleSensors, `${sensor.id} → ${aircraftId}`).toContain(
          sensor.id,
        );
      }
    }
    for (const aircraft of AIRCRAFT) {
      for (const sensorId of aircraft.compatibleSensors) {
        if (sensorId === 'POD_LIDAR') {
          expect(getPayload(sensorId).compatibleAircraft).toContain(aircraft.id);
        } else {
          expect(getSensor(sensorId).compatibleAircraft, `${aircraft.id} → ${sensorId}`).toContain(
            aircraft.id,
          );
        }
      }
    }
  });

  it('o pod aponta para a câmera RGB embutida e para aeronaves que o aceitam', () => {
    for (const pod of PAYLOADS) {
      expect(getSensor(pod.rgbSensorId).kind).toBe('RGB');
      for (const aircraftId of pod.compatibleAircraft) {
        expect(getAircraft(aircraftId).compatibleSensors).toContain(pod.id);
      }
    }
  });

  it('pré-requisitos de skills existem, no mesmo ramo e no rank anterior', () => {
    for (const skill of SKILLS) {
      if (skill.rank === 1) {
        expect(skill.requires, skill.id).toBeUndefined();
        continue;
      }
      const parent = SKILLS.find((s) => s.id === skill.requires);
      expect(parent, skill.id).toBeDefined();
      expect(parent?.branch).toBe(skill.branch);
      expect(parent?.rank).toBe(skill.rank - 1);
    }
  });

  it('cosméticos têm desbloqueio válido', () => {
    const valid = (c: UnlockCondition): boolean => {
      switch (c.type) {
        case 'ALWAYS':
          return true;
        case 'CONTRACT_DONE':
          return CONTRACT_IDS.includes(c.contractId);
        case 'REPUTATION':
          return c.min >= 0 && c.min <= 100;
        case 'LEVEL':
          return Number.isInteger(c.min) && c.min >= 1;
        case 'OWNS':
          return ALL_ITEM_IDS.has(c.itemId);
        case 'RIFTS_DONE':
          return Number.isInteger(c.count) && c.count >= 1 && c.count <= 11;
        case 'ALL':
        case 'ANY':
          return c.of.length > 0 && c.of.every(valid);
      }
    };
    for (const cosmetic of COSMETICS) {
      if (cosmetic.unlock) expect(valid(cosmetic.unlock), cosmetic.id).toBe(true);
      // Gratuitos sem desbloqueio só podem ser os iniciais.
      if (cosmetic.priceBRL === 0 && !cosmetic.unlock) {
        expect(STARTING_COSMETICS, cosmetic.id).toContain(cosmetic.id);
      }
      expect(cosmetic.colors.primary).toMatch(/^#[0-9a-f]{6}$/);
      expect(cosmetic.colors.secondary).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const id of STARTING_COSMETICS) {
      expect(initialInventory().cosmetics).toContain(id);
    }
  });

  it('combo T2, pré-requisitos de compra e câmeras avulsas apontam para itens existentes', () => {
    for (const id of T2_COMBO_ITEMS) expect(ALL_ITEM_IDS.has(id), id).toBe(true);
    for (const [item, required] of Object.entries(PURCHASE_PREREQUISITES)) {
      expect(ALL_ITEM_IDS.has(item), item).toBe(true);
      expect(ALL_ITEM_IDS.has(required), required).toBe(true);
    }
    expect(PURCHASE_PREREQUISITES).toMatchObject({
      DRONE_T2: 'DRONE_T1',
      VTOL_T3: 'DRONE_T2',
      POD_LIDAR: 'VTOL_T3',
      GAMER_PC: 'OLD_LAPTOP',
      MULTI_GPU_WS: 'GAMER_PC',
      CLOUD: 'MULTI_GPU_WS',
    });
    expect(PURCHASABLE_SENSORS).toEqual(['CAM_45MP_FF', 'CAM_MS5', 'CAM_THERMAL']);
  });

  it('souvenirs: um por contrato (18), com ícone lucide existente', () => {
    expect(SOUVENIRS.map((s) => s.contractId).sort()).toEqual([...CONTRACT_IDS].sort());
    for (const souvenir of SOUVENIRS) {
      expect(Object.hasOwn(lucide, souvenir.icon), souvenir.icon).toBe(true);
      // E registrado para o `NamedIcon` (senão aparece o ícone de reserva).
      expect(hasIcon(souvenir.icon), souvenir.icon).toBe(true);
      expect(souvenir.story.length).toBeGreaterThan(20);
      expect(souvenir.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('valores normativos', () => {
  it('pixel pitch calculado bate com a coluna "Pixel (µm)" (± 0,5 %)', () => {
    const expected: Record<string, number> = {
      CAM_PIGEON: 1.89,
      CAM_20MP_RS: 2.412,
      CAM_45MP_FF: 4.382,
      CAM_MS5: 3.45,
      CAM_THERMAL: 17.0,
      CAM_POD_RGB: 3.277,
    };
    for (const sensor of SENSORS) {
      const pitchUm = (sensor.sensorWidthMm / sensor.imageWidthPx) * 1000;
      const target = expected[sensor.id] as number;
      expect(Math.abs(pitchUm - target) / target, sensor.id).toBeLessThan(0.005);
    }
  });

  it('crop factor = 43,27 mm / diagonal do sensor (± 1 %) e 8,8 mm ≈ 24 mm equivalente', () => {
    for (const sensor of SENSORS) {
      const crop = 43.27 / Math.hypot(sensor.sensorWidthMm, sensor.sensorHeightMm);
      expect(Math.abs(crop - sensor.cropFactor) / sensor.cropFactor, sensor.id).toBeLessThan(0.01);
    }
    const rs = getSensor('CAM_20MP_RS');
    expect((rs.fixedFocalMm as number) * rs.cropFactor).toBeCloseTo(24, 0);
  });

  it('lente fixa tem focal; rolling shutter tem tempo de leitura', () => {
    for (const sensor of SENSORS) {
      expect(sensor.fixedFocalMm !== undefined, sensor.id).toBe(sensor.lensMount === 'FIXED');
      expect(sensor.readoutS !== undefined, sensor.id).toBe(sensor.shutter === 'ROLLING');
    }
    expect(getSensor('CAM_MS5').bands).toEqual(['B', 'G', 'R', 'RE', 'NIR']);
  });

  it('cada ramo de skills tem 4 nós (ranks 1–4) que somam 6 pontos; 18 no total', () => {
    const branches = ['PILOT', 'ENGINEERING', 'MANAGEMENT'] as const;
    for (const branch of branches) {
      const nodes = SKILLS.filter((s) => s.branch === branch);
      expect(nodes.map((n) => n.rank)).toEqual([1, 2, 3, 4]);
      expect(nodes.reduce((sum, n) => sum + n.cost, 0)).toBe(6);
    }
    expect(SKILLS.reduce((sum, n) => sum + n.cost, 0)).toBe(18);
  });

  it('preços em centavos inteiros', () => {
    expect(brl(5_000)).toBe(500_000);
    const prices = [
      ...SENSORS,
      ...LENSES,
      ...PAYLOADS,
      ...AIRCRAFT,
      ...VEHICLES,
      ...FIELD_EQUIPMENT,
      ...HARDWARE,
      ...COSMETICS,
    ].map((i) => i.priceBRL);
    for (const p of prices) expect(Number.isInteger(p) && p >= 0).toBe(true);
    expect(getAircraft('DRONE_T1').priceBRL).toBe(600_000);
    expect(getHardware('GAMER_PC').priceBRL).toBe(900_000);
    expect(getStaffRole('INTERN').costPerContractBRL).toBe(50_000);
    expect(ATLAS_RULES.cornPriceBRL).toBe(500);
  });

  it('nenhum veículo atravessa água, montanha ou prédio; só a 4x4 vai ao brejo', () => {
    for (const v of VEHICLES) {
      expect(v.speedTilesS.WATER, v.id).toBeUndefined();
      expect(v.speedTilesS.MOUNTAIN, v.id).toBeUndefined();
      expect(v.speedTilesS.BUILDING, v.id).toBeUndefined();
      expect(v.allowSwamp).toBe(v.speedTilesS.SWAMP !== undefined);
    }
    expect(VEHICLES.filter((v) => v.processesInField).map((v) => v.id)).toEqual(['LAB_VAN']);
  });

  it('limites de pontos por instrumento somam o máximo do equipamento', () => {
    expect(POINT_LIMITS.GNSS_RTK_KIT.gcp + POINT_LIMITS.GNSS_RTK_KIT.cp).toBe(
      getFieldEquipment('GNSS_RTK_KIT').maxPoints,
    );
    expect(POINT_LIMITS.TOTAL_STATION.gcp).toBe(getFieldEquipment('TOTAL_STATION').maxPoints);
  });

  it('a paleta do emblema tem os tokens e as 4 cores extras, sem repetição', () => {
    expect(EMBLEM_PALETTE).toContain('#22d3ee');
    expect(EMBLEM_PALETTE).toContain('#f97316');
    expect(unique(EMBLEM_PALETTE)).toBe(true);
    expect(EMBLEM_PALETTE).toHaveLength(16);
  });
});
