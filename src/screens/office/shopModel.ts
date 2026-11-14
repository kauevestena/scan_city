/** Modelo da Garagem (office §5): abas, estado dos cards e a tabela de especificações. */
import {
  getAircraft,
  getFieldEquipment,
  getSensor,
  getVehicle,
  LENSES,
  PAYLOADS,
  T2_COMBO_ITEMS,
} from '@/data/catalog';
import { COSMETICS } from '@/data/cosmetics';
import { STRINGS } from '@/data/strings';
import {
  canBuy,
  itemName,
  ownsItem,
  SHOP_ITEMS,
  shopPrice,
  type ShopInventory,
  type ShopItem,
} from '@/domain/economy';
import { evaluateUnlock, type UnlockState } from '@/domain/progression';
import { formatDuration, formatNumber } from '@/lib/format';
import { PURCHASE_PREREQUISITES } from '@/data/catalog';

const G = STRINGS.office.garage;
const S = G.specs;

export type GarageTab = 'AIRCRAFT' | 'SENSORS' | 'VEHICLES' | 'FIELD' | 'PAINT';
export const GARAGE_TABS: readonly GarageTab[] = [
  'AIRCRAFT',
  'SENSORS',
  'VEHICLES',
  'FIELD',
  'PAINT',
];

const KINDS: Record<GarageTab, ReadonlySet<ShopItem['kind']>> = {
  AIRCRAFT: new Set(['AIRCRAFT']),
  SENSORS: new Set(['SENSOR', 'LENS', 'PAYLOAD']),
  VEHICLES: new Set(['VEHICLE']),
  FIELD: new Set(['FIELD_EQUIPMENT']),
  PAINT: new Set(['COSMETIC']),
};

/** Itens de uma aba. A pintura mostra só as tintas dos drones (skins e acessórios têm outros painéis). */
export function itemsOfTab(tab: GarageTab): ShopItem[] {
  return SHOP_ITEMS.filter((item) => {
    if (!KINDS[tab].has(item.kind)) return false;
    if (tab === 'PAINT') return COSMETICS.find((c) => c.id === item.id)?.slot === 'DRONE_PAINT';
    return true;
  });
}

export type CardState =
  | { kind: 'OWNED' }
  /** Pré-requisito ou desbloqueio faltando: o botão não aparece. */
  | { kind: 'LOCKED'; reason: string }
  | { kind: 'BUY' };

export interface ShopContext {
  money: number;
  inventory: ShopInventory;
  unlock: UnlockState;
  shopPriceMod: number;
}

/**
 * Possuído, bloqueado ("Requer <item>") ou comprável. Falta de saldo não bloqueia o card:
 * o clique no botão toca `DENIED` e mostra o que falta (office §7).
 */
export function cardState(item: ShopItem, ctx: ShopContext): CardState {
  if (ownsItem(ctx.inventory, item.id)) return { kind: 'OWNED' };
  const required = PURCHASE_PREREQUISITES[item.id];
  if (required && !ownsItem(ctx.inventory, required)) {
    return { kind: 'LOCKED', reason: G.requires(itemName(required)) };
  }
  if (item.unlock && !evaluateUnlock(item.unlock, ctx.unlock)) {
    // Reaproveita o texto de `canBuy` ("Bloqueado: …").
    const check = canBuy(item, { ...ctx, money: Number.MAX_SAFE_INTEGER });
    return { kind: 'LOCKED', reason: check.reason ?? G.requires(item.name) };
  }
  return { kind: 'BUY' };
}

export function priceOf(item: ShopItem, shopPriceMod: number): number {
  return shopPrice(item.priceBRL, shopPriceMod);
}

/** Itens do combo T2 que o jogador já tem (o card avisa antes da compra). */
export function comboOwned(inventory: ShopInventory): string[] {
  return T2_COMBO_ITEMS.filter((id) => id !== 'DRONE_T2' && ownsItem(inventory, id));
}

const yn = (v: boolean) => (v ? S.yes : S.no);

/** Tabela compacta de especificações (mono) de um item. */
export function specRows(item: ShopItem): Array<[label: string, value: string]> {
  switch (item.kind) {
    case 'AIRCRAFT': {
      const a = getAircraft(item.id as Parameters<typeof getAircraft>[0]);
      return [
        [S.type, G.kinds[a.kind]],
        [S.speed, S.speedValue(formatNumber(a.vMinMs, 0), formatNumber(a.vMaxMs, 0))],
        [S.endurance, a.energyUnit === 'CORN' ? S.cornUnits(10) : formatDuration(a.enduranceS)],
        [S.height, S.heightValue(formatNumber(a.hMinM, 0), formatNumber(a.hMaxM, 0))],
        [S.wind, S.windValue(formatNumber(a.windToleranceMs, 0))],
        [S.rtk, yn(a.rtk)],
        [S.hull, String(a.hull)],
      ];
    }
    case 'SENSOR': {
      const c = getSensor(item.id);
      const mp = (c.imageWidthPx * c.imageHeightPx) / 1e6;
      return [
        [S.type, G.kinds[c.kind]],
        [
          S.sensor,
          S.sensorValue(formatNumber(c.sensorWidthMm, 1), formatNumber(c.sensorHeightMm, 1)),
        ],
        [
          S.resolution,
          S.resolutionValue(String(c.imageWidthPx), String(c.imageHeightPx), formatNumber(mp, 0)),
        ],
        [S.shutter, G.shutters[c.shutter]],
      ];
    }
    case 'LENS': {
      const l = LENSES.find((x) => x.id === item.id);
      return l ? [[S.focal, S.focalValue(l.equivFocalMm)]] : [];
    }
    case 'PAYLOAD': {
      const p = PAYLOADS.find((x) => x.id === item.id);
      return p
        ? [
            [S.prr, S.prrValue(formatNumber(p.prrHz / 1000, 0))],
            [S.fov, S.fovValue(p.fovDeg)],
            [S.returns, String(p.maxReturns)],
            [S.accuracy, S.accuracyValue(formatNumber(p.rangeAccuracyM * 100, 1))],
          ]
        : [];
    }
    case 'VEHICLE': {
      const v = getVehicle(item.id as Parameters<typeof getVehicle>[0]);
      return [
        [S.gcpReach, S.reachValue(v.gcpReachM)],
        [S.slope, S.slopeValue(v.maxSlopePct)],
        [S.swamp, yn(v.allowSwamp)],
        [
          S.field,
          v.processesInField ? S.fieldValue(formatNumber(v.fieldSpeedFactor ?? 1, 1)) : S.no,
        ],
      ];
    }
    case 'FIELD_EQUIPMENT': {
      const f = getFieldEquipment(item.id as Parameters<typeof getFieldEquipment>[0]);
      return [
        [S.sigma, S.sigmaValue(formatNumber(f.sigmaBaseM * 100, 1))],
        [S.points, String(f.maxPoints)],
        [S.rtk, yn(f.providesRtkCorrections)],
      ];
    }
    default:
      return [];
  }
}
