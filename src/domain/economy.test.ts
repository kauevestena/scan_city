import { brl } from '@/data/catalog';
import { initialInventory } from '@/state/slices/inventorySlice';
import type { PaymentInput } from './mission';
import { qualityFactor } from './mission';
import {
  addItems,
  canBuy,
  computePayment,
  computeRewards,
  itemName,
  ownsItem,
  purchaseItems,
  shopItem,
  shopPrice,
  type BuyState,
} from './economy';
import { applyModifiers } from './modifiers';

const plain = (s: string | undefined) => (s ?? '').replace(/\s/g, ' ');

const payment = (over: Partial<PaymentInput> = {}): PaymentInput => ({
  baseBRL: brl(12_000),
  isReplay: false,
  qualityFactor: qualityFactor(0.8, false, [], false),
  rivalFactor: 1,
  contractPaymentMod: 1.25,
  staff: { INTERN: 1, JUNIOR_ENG: 0 },
  penaltiesBRL: 0,
  ...over,
});

describe('computePayment (domain-math §12.1)', () => {
  it('G20 — base R$ 12.000, score 0,8, sem falhas, G = 1,25, 1 estagiário → R$ 14.128,00', () => {
    const p = computePayment(payment());
    expect(p.totalBRL).toBe(brl(14_128));
    expect(p).toMatchObject({ replayFactor: 1, managementBonus: 1.25, staffCostBRL: brl(500) });
    expect(p.staffBonus).toBeCloseTo(1.06, 12);
  });

  it('replay paga 40 %; a MegaMap reduz 15 %; equipe e reparos são descontados', () => {
    const base = payment({
      staff: { INTERN: 0, JUNIOR_ENG: 0 },
      contractPaymentMod: 1,
      qualityFactor: 1,
    });
    expect(computePayment({ ...base, isReplay: true }).totalBRL).toBe(brl(4_800));
    expect(computePayment({ ...base, rivalFactor: 0.85 }).totalBRL).toBe(brl(10_200));
    const crew = computePayment({
      ...base,
      staff: { INTERN: 1, JUNIOR_ENG: 2 },
      penaltiesBRL: brl(900),
    });
    expect(crew.staffBonus).toBeCloseTo(1 + 0.06 + 0.3, 12);
    expect(crew.totalBRL).toBe(Math.round(brl(12_000) * 1.36) - brl(500 + 3_600) - brl(900));
  });

  it('a dificuldade do voo multiplica o bruto: a fácil paga menos, a difícil mais (ADR-035)', () => {
    const base = payment({
      staff: { INTERN: 0, JUNIOR_ENG: 0 },
      contractPaymentMod: 1,
      qualityFactor: 1,
    });
    expect(computePayment(base)).toMatchObject({ difficultyFactor: 1, totalBRL: brl(12_000) });
    expect(computePayment({ ...base, difficultyFactor: 0.8 }).totalBRL).toBe(brl(9_600));
    expect(computePayment({ ...base, difficultyFactor: 1.25 })).toMatchObject({
      difficultyFactor: 1.25,
      totalBRL: brl(15_000),
    });
  });

  it('nunca fica negativo: o que não couber é perdoado', () => {
    expect(
      computePayment(payment({ qualityFactor: 0.1, penaltiesBRL: brl(50_000) })).totalBRL,
    ).toBe(0);
  });
});

describe('computeRewards', () => {
  const r = {
    xp: 400,
    reputationReward: 8,
    isReplay: false,
    score: 0.8,
    critical: false,
    reputationGainMod: 1,
  };
  it('aprovado: xp·r·(0,5 + 0,5·score) e reputação·(0,5 + score)·ganho', () => {
    expect(computeRewards(r)).toEqual({ xp: 360, reputationDelta: 10 });
    expect(computeRewards({ ...r, isReplay: true }).xp).toBe(144);
    expect(computeRewards({ ...r, reputationGainMod: 1.5 }).reputationDelta).toBe(16);
  });
  it('crítico: 10 % do XP e −10 de reputação (replay: no máximo −3)', () => {
    expect(computeRewards({ ...r, critical: true })).toEqual({ xp: 40, reputationDelta: -10 });
    expect(computeRewards({ ...r, critical: true, isReplay: true }).reputationDelta).toBe(-3);
  });
});

describe('loja (progression §5)', () => {
  const unlock = {
    completedContracts: new Set<string>(),
    level: 1,
    reputation: 30,
    ownedItems: new Set<string>(),
    riftsDone: 0,
  };
  const state = (over: Partial<BuyState> = {}): BuyState => ({
    money: brl(1_000),
    inventory: initialInventory(),
    unlock,
    shopPriceMod: 1,
    ...over,
  });

  it('com R$ 1.000, o PC Gamer (R$ 9.000) é recusado', () => {
    const res = canBuy(shopItem('GAMER_PC'), state());
    expect(res.ok).toBe(false);
    expect(plain(res.reason)).toBe('Saldo insuficiente (faltam R$ 8.000,00)');
  });

  it('com GES_3, o Drone T1 custa R$ 5.100', () => {
    const mods = applyModifiers(['GES_1', 'GES_2', 'GES_3']);
    expect(shopPrice(shopItem('DRONE_T1').priceBRL, mods.shopPrice)).toBe(brl(5_100));
    expect(
      canBuy(shopItem('DRONE_T1'), state({ money: brl(5_100), shopPriceMod: mods.shopPrice })).ok,
    ).toBe(true);
    expect(
      canBuy(shopItem('DRONE_T1'), state({ money: brl(5_099), shopPriceMod: mods.shopPrice })).ok,
    ).toBe(false);
  });

  it('razões, na ordem: possuído, pré-requisito, desbloqueio, saldo', () => {
    const rich = brl(1_000_000);
    expect(canBuy(shopItem('ATLAS'), state({ money: rich })).reason).toBe(
      'Você já possui este item',
    );
    expect(canBuy(shopItem('OLD_LAPTOP'), state({ money: rich })).reason).toBe(
      'Você já possui este item',
    );
    expect(canBuy(shopItem('DRONE_T2'), state({ money: rich })).reason).toBe(
      'Exige possuir Drone Amador "Faísca"',
    );
    expect(canBuy(shopItem('POD_LIDAR'), state({ money: rich })).reason).toBe(
      'Exige possuir Asa Fixa VTOL "Albatroz"',
    );
    expect(canBuy(shopItem('MULTI_GPU_WS'), state({ money: rich })).reason).toBe(
      'Exige possuir PC Gamer',
    );
    expect(canBuy(shopItem('CHAR_UNIFORM'), state({ money: rich })).reason).toBe(
      'Bloqueado: nível 3',
    );
    expect(canBuy(shopItem('ATLAS_GPS_PACK'), state({ money: rich })).reason).toBe(
      'Bloqueado: possuir Kit GNSS RTK Base + Rover',
    );
    expect(canBuy(shopItem('CHAR_GRANDPA_HAT'), state({ money: rich })).reason).toMatch(
      /^Bloqueado: concluir o contrato C00 e .* e concluir o contrato C06$/,
    );
    expect(
      canBuy(shopItem('CHAR_UNIFORM'), state({ money: rich, unlock: { ...unlock, level: 3 } })).ok,
    ).toBe(true);
  });

  it('o combo T2 adiciona só os itens que faltam; hardware substitui', () => {
    const inv = {
      ...initialInventory(),
      aircraft: ['ATLAS', 'DRONE_T1'] as const,
      lenses: ['LENS_35'] as const,
    };
    const mutable = { ...inv, aircraft: [...inv.aircraft], lenses: [...inv.lenses] };
    expect(purchaseItems('DRONE_T2', mutable)).toEqual(['DRONE_T2', 'CAM_45MP_FF', 'GNSS_RTK_KIT']);
    expect(purchaseItems('GAMER_PC', mutable)).toEqual(['GAMER_PC']);
    const after = addItems(mutable, purchaseItems('DRONE_T2', mutable));
    expect(after.aircraft).toContain('DRONE_T2');
    expect(after.sensors).toContain('CAM_45MP_FF');
    expect(after.fieldEquipment).toContain('GNSS_RTK_KIT');
    expect(after.lenses).toEqual(['LENS_35']);
    expect(addItems(after, ['GAMER_PC']).hardware).toBe('GAMER_PC');
    expect(ownsItem(addItems(after, ['CLOUD']), 'GAMER_PC')).toBe(true);
  });

  it('addItems cobre cada tipo e traz as câmeras embutidas', () => {
    const inv = addItems(initialInventory(), [
      'DRONE_T1',
      'LENS_24',
      'POD_LIDAR',
      'PICKUP_4X4',
      'CAM_MS5',
      'PAINT_RADAR',
      'PAINT_RADAR',
    ]);
    expect(inv.sensors).toEqual(expect.arrayContaining(['CAM_20MP_RS', 'CAM_POD_RGB', 'CAM_MS5']));
    expect(inv.payloads).toEqual(['POD_LIDAR']);
    expect(inv.vehicles).toContain('PICKUP_4X4');
    expect(inv.lenses).toEqual(['LENS_24']);
    expect(inv.cosmetics.filter((c) => c === 'PAINT_RADAR')).toHaveLength(1);
    expect(ownsItem(inv, 'NOPE')).toBe(false);
    expect(itemName('NOPE')).toBe('NOPE');
    expect(() => shopItem('NOPE')).toThrow(RangeError);
  });
});
