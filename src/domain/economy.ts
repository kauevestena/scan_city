/** Economia — domain-math §12.1 e progression §4–§5: pagamento, recompensas e loja. */
import {
  AIRCRAFT,
  FIELD_EQUIPMENT,
  HARDWARE_ORDER,
  HARDWARE,
  LENSES,
  PAYLOADS,
  PURCHASE_PREREQUISITES,
  SENSORS,
  STAFF,
  T2_COMBO_ITEMS,
  VEHICLES,
} from '@/data/catalog';
import { COSMETICS } from '@/data/cosmetics';
import { STRINGS } from '@/data/strings';
import { formatBRL } from '@/lib/format';
import type { CentsBRL, PaymentBreakdown, SaveGame, StaffRole, UnlockCondition } from '@/types';
import type { PaymentInput, RewardInput } from './mission';
import { describeUnlock, evaluateUnlock, type UnlockState } from './progression';

export const REPLAY_FACTOR = 0.4;
/** Perda de reputação numa falha crítica (em replay, no máximo −3). */
export const CRITICAL_REPUTATION_LOSS = -10;
export const REPLAY_MAX_REPUTATION_LOSS = -3;

/** §12.1 — total = max(0, round(base·r·Q·R·G·E) − equipe − penalidades). */
export function computePayment(
  input: PaymentInput,
  roles: readonly Pick<StaffRole, 'id' | 'paymentBonus' | 'costPerContractBRL'>[] = STAFF,
): PaymentBreakdown {
  const replayFactor = input.isReplay ? REPLAY_FACTOR : 1;
  const staffBonus = 1 + roles.reduce((s, r) => s + r.paymentBonus * (input.staff[r.id] ?? 0), 0);
  const staffCostBRL = roles.reduce(
    (s, r) => s + r.costPerContractBRL * (input.staff[r.id] ?? 0),
    0,
  );
  const gross = Math.round(
    input.baseBRL *
      replayFactor *
      input.qualityFactor *
      input.rivalFactor *
      input.contractPaymentMod *
      staffBonus,
  );
  return {
    baseBRL: input.baseBRL,
    replayFactor,
    qualityFactor: input.qualityFactor,
    rivalFactor: input.rivalFactor,
    managementBonus: input.contractPaymentMod,
    staffBonus,
    staffCostBRL,
    penaltiesBRL: input.penaltiesBRL,
    // Não existe dívida: o que não couber no pagamento é perdoado (progression §4).
    totalBRL: Math.max(0, gross - staffCostBRL - input.penaltiesBRL),
  };
}

/** §12.1 — XP e reputação do contrato. */
export function computeRewards(input: RewardInput): { xp: number; reputationDelta: number } {
  const r = input.isReplay ? REPLAY_FACTOR : 1;
  if (input.critical) {
    return {
      xp: Math.round(0.1 * input.xp),
      reputationDelta: input.isReplay ? REPLAY_MAX_REPUTATION_LOSS : CRITICAL_REPUTATION_LOSS,
    };
  }
  return {
    xp: Math.round(input.xp * r * (0.5 + 0.5 * input.score)),
    reputationDelta: Math.round(
      input.reputationReward * (0.5 + input.score) * input.reputationGainMod,
    ),
  };
}

/** Preço na loja com o desconto das habilidades. */
export function shopPrice(priceBRL: CentsBRL, shopPriceMod: number): CentsBRL {
  return Math.round(priceBRL * shopPriceMod);
}

// --- Loja ----------------------------------------------------------------------------

export type ShopItemKind =
  | 'AIRCRAFT'
  | 'SENSOR'
  | 'LENS'
  | 'PAYLOAD'
  | 'VEHICLE'
  | 'FIELD_EQUIPMENT'
  | 'HARDWARE'
  | 'COSMETIC';

export interface ShopItem {
  id: string;
  kind: ShopItemKind;
  name: string;
  priceBRL: CentsBRL;
  unlock?: UnlockCondition;
}

const ITEMS: readonly ShopItem[] = [
  ...AIRCRAFT.map((a) => ({
    id: a.id,
    kind: 'AIRCRAFT' as const,
    name: a.name,
    priceBRL: a.priceBRL,
  })),
  ...SENSORS.map((s) => ({
    id: s.id,
    kind: 'SENSOR' as const,
    name: s.name,
    priceBRL: s.priceBRL,
  })),
  ...LENSES.map((l) => ({ id: l.id, kind: 'LENS' as const, name: l.name, priceBRL: l.priceBRL })),
  ...PAYLOADS.map((p) => ({
    id: p.id,
    kind: 'PAYLOAD' as const,
    name: p.name,
    priceBRL: p.priceBRL,
  })),
  ...VEHICLES.map((v) => ({
    id: v.id,
    kind: 'VEHICLE' as const,
    name: v.name,
    priceBRL: v.priceBRL,
  })),
  ...FIELD_EQUIPMENT.map((f) => ({
    id: f.id,
    kind: 'FIELD_EQUIPMENT' as const,
    name: f.name,
    priceBRL: f.priceBRL,
  })),
  ...HARDWARE.map((h) => ({
    id: h.id,
    kind: 'HARDWARE' as const,
    name: h.name,
    priceBRL: h.priceBRL,
  })),
  ...COSMETICS.map((c) => {
    const item: ShopItem = { id: c.id, kind: 'COSMETIC', name: c.name, priceBRL: c.priceBRL };
    if (c.unlock) item.unlock = c.unlock;
    return item;
  }),
];

export function shopItem(id: string): ShopItem {
  const item = ITEMS.find((i) => i.id === id);
  if (!item) throw new RangeError(`Item de loja desconhecido: ${id}`);
  return item;
}

export const itemName = (id: string): string => ITEMS.find((i) => i.id === id)?.name ?? id;

export type ShopInventory = SaveGame['inventory'];

/** O jogador já tem o item? Hardware conta como possuído se o atual for igual ou melhor. */
export function ownsItem(inventory: ShopInventory, id: string): boolean {
  const item = ITEMS.find((i) => i.id === id);
  if (!item) return false;
  switch (item.kind) {
    case 'AIRCRAFT':
      return inventory.aircraft.includes(id as (typeof inventory.aircraft)[number]);
    case 'SENSOR':
      return inventory.sensors.includes(id);
    case 'LENS':
      return inventory.lenses.includes(id as (typeof inventory.lenses)[number]);
    case 'PAYLOAD':
      return inventory.payloads.includes(id as (typeof inventory.payloads)[number]);
    case 'VEHICLE':
      return inventory.vehicles.includes(id as (typeof inventory.vehicles)[number]);
    case 'FIELD_EQUIPMENT':
      return inventory.fieldEquipment.includes(id as (typeof inventory.fieldEquipment)[number]);
    case 'HARDWARE':
      return (
        HARDWARE_ORDER.indexOf(id as (typeof HARDWARE_ORDER)[number]) <=
        HARDWARE_ORDER.indexOf(inventory.hardware)
      );
    case 'COSMETIC':
      return inventory.cosmetics.includes(id);
  }
}

export interface BuyState {
  money: CentsBRL;
  inventory: ShopInventory;
  unlock: UnlockState;
  shopPriceMod: number;
}

/**
 * Pode comprar? Verifica, nesta ordem (progression §5): já possuído; pré-requisito;
 * desbloqueio (cosméticos); saldo com o preço com desconto.
 */
export function canBuy(item: ShopItem, state: BuyState): { ok: boolean; reason?: string } {
  if (ownsItem(state.inventory, item.id)) return { ok: false, reason: STRINGS.shop.owned };
  const required = PURCHASE_PREREQUISITES[item.id];
  if (required && !ownsItem(state.inventory, required)) {
    return { ok: false, reason: STRINGS.shop.requires(itemName(required)) };
  }
  if (item.unlock && !evaluateUnlock(item.unlock, state.unlock)) {
    return { ok: false, reason: STRINGS.shop.locked(describeUnlock(item.unlock, itemName)) };
  }
  const price = shopPrice(item.priceBRL, state.shopPriceMod);
  if (price > state.money) {
    return { ok: false, reason: STRINGS.economy.insufficientFunds(formatBRL(price - state.money)) };
  }
  return { ok: true };
}

/** Itens adicionados pela compra: o combo T2 inclui os itens que faltam (ADR-015). */
export function purchaseItems(id: string, inventory: ShopInventory): string[] {
  if (id === 'DRONE_T2') return T2_COMBO_ITEMS.filter((item) => !ownsItem(inventory, item));
  return [id];
}

/** Inventário depois de receber os itens (hardware substitui o anterior). */
export function addItems(inventory: ShopInventory, ids: readonly string[]): ShopInventory {
  const next: ShopInventory = {
    ...inventory,
    aircraft: [...inventory.aircraft],
    sensors: [...inventory.sensors],
    lenses: [...inventory.lenses],
    payloads: [...inventory.payloads],
    vehicles: [...inventory.vehicles],
    fieldEquipment: [...inventory.fieldEquipment],
    cosmetics: [...inventory.cosmetics],
  };
  for (const id of ids) {
    if (ownsItem(next, id)) continue;
    const item = shopItem(id);
    switch (item.kind) {
      case 'AIRCRAFT':
        next.aircraft.push(id as (typeof next.aircraft)[number]);
        break;
      case 'SENSOR':
        next.sensors.push(id);
        break;
      case 'LENS':
        next.lenses.push(id as (typeof next.lenses)[number]);
        break;
      case 'PAYLOAD':
        next.payloads.push(id as (typeof next.payloads)[number]);
        // O pod traz a câmera RGB embutida.
        if (!next.sensors.includes('CAM_POD_RGB')) next.sensors.push('CAM_POD_RGB');
        break;
      case 'VEHICLE':
        next.vehicles.push(id as (typeof next.vehicles)[number]);
        break;
      case 'FIELD_EQUIPMENT':
        next.fieldEquipment.push(id as (typeof next.fieldEquipment)[number]);
        break;
      case 'HARDWARE':
        next.hardware = id as typeof next.hardware;
        break;
      case 'COSMETIC':
        next.cosmetics.push(id);
        break;
    }
    // A aeronave T1 vem com a sua câmera.
    if (id === 'DRONE_T1' && !next.sensors.includes('CAM_20MP_RS'))
      next.sensors.push('CAM_20MP_RS');
  }
  return next;
}
