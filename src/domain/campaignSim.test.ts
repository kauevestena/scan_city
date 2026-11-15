/**
 * Simulação de campanha (T071, catalog §13): segue a ordem do roteiro com score fixo de 0,8
 * (qualityFactor 0,92), sem renda passiva, sem equipe e sem contraproposta, e confere, pela store
 * de verdade, que o jogador desbloqueia cada contrato a tempo e compra os itens do plano de
 * referência dele antes de aceitá-lo. Depois do roteiro, as três fendas que sobram (R04, R06, R10)
 * fecham a coleção de 11 fendas.
 */
import { getContract } from '@/data/contracts';
import { brl } from '@/data/catalog';
import { COSMETICS } from '@/data/cosmetics';
import { FINALE_REWARD } from '@/data/office';
import { formatBRL } from '@/lib/format';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import type { Contract, ContractStatus, MissionData, QualityReport } from '@/types';
import { canBuy, computePayment, computeRewards, ownsItem, shopItem, shopPrice } from './economy';
import { qualityFactor } from './mission';
import { finaleDue, unlockStateFrom } from './progression';

const get = () => useGameStore.getState();

/** O roteiro de catalog §13 e, depois dele, as fendas que faltam para as 11. */
const SCRIPT = [
  'C00',
  'C01',
  'R01',
  'R02',
  'C05',
  'C06',
  'R07',
  'R08',
  'R11',
  'C02',
  'R09',
  'C04',
  'R03',
  'R05',
  'C03',
] as const;
const EPILOGUE = ['R04', 'R06', 'R10'] as const;
const SCORE = 0.8;

/** Saldos da simulação manual de catalog §13 (R$), com o qualityFactor de 0,92. */
const SPEC_BALANCE_BRL: Record<string, number> = {
  C00: 7_300,
  C01: 12_340,
  R01: 35_340,
  R02: 62_940,
  C05: 79_500,
  C06: 29_740,
  R07: 94_140,
  R08: 119_900,
  R11: 179_700,
  C02: 59_900,
  R09: 96_700,
  C04: 92_300,
  R03: 133_700,
  R05: 179_700,
  C03: 112_500,
};
/** A tabela manual não conta a LENS_24 (R$ 6.000): o combo T2 só traz a LENS_35 e o C06 e as fendas de T2 usam a 24 mm. */
const LENS_24_BRL = 6_000;

/** Cosméticos de coleção, e quando cada um passa a poder ser pego (grátis, sem compra de saldo). */
const COLLECTION = [
  'CHAR_MULTIVERSE',
  'PAINT_HOLO',
  'PAINT_CAMO',
  'ATLAS_LAUREL',
  'CHAR_GRANDPA_HAT',
] as const;

interface Step {
  id: string;
  statusBefore: ContractStatus | undefined;
  r10StatusBefore: ContractStatus | undefined;
  reputationBefore: number;
  moneyBefore: number;
  bought: Array<{ item: string; priceBRL: number }>;
  shortfalls: string[];
  moneyAfterPurchases: number;
  paymentBRL: number;
  moneyAfter: number;
  reputationAfter: number;
  riftsDone: number;
  /** Cosméticos de coleção que `canBuy` libera depois do contrato. */
  buyable: string[];
  realDone: number;
  finaleDueAfter: boolean;
}

/** Itens do plano de referência: aeronave, sensor (câmera ou pod), lente e veículo mínimo. */
function planItems(c: Contract): string[] {
  const p = c.referencePlan;
  return [p.aircraftId, p.sensorId, ...(p.lensId ? [p.lensId] : []), c.minVehicle];
}

/** O relatório de um contrato aprovado com o score fixo; o pagamento e as recompensas vêm das fórmulas de verdade. */
function approvedReport(c: Contract, isReplay = false, critical = false): QualityReport {
  const mods = selectModifiers(get());
  const q = critical ? 0.1 : qualityFactor(SCORE, false, [], false);
  const payment = computePayment({
    baseBRL: c.basePaymentBRL,
    isReplay,
    qualityFactor: q,
    rivalFactor: 1,
    contractPaymentMod: mods.contractPayment,
    staff: { INTERN: 0, JUNIOR_ENG: 0 },
    penaltiesBRL: 0,
  });
  const rewards = computeRewards({
    xp: c.xp,
    reputationReward: c.reputationReward,
    isReplay,
    score: critical ? 0 : SCORE,
    critical,
    reputationGainMod: mods.reputationGain,
  });
  return {
    missionId: `sim-${c.id}-${get().contracts[c.id]?.completions ?? 0}${isReplay ? '-replay' : ''}`,
    contractId: c.id,
    approved: !critical,
    critical,
    qualityScore: critical ? 0 : SCORE,
    payment,
    xp: rewards.xp,
    reputationDelta: rewards.reputationDelta,
    ...(!critical && !isReplay ? { souvenirAwarded: c.souvenirId } : {}),
  } as unknown as QualityReport;
}

/** Enfileira uma missão sintética do contrato e aplica o relatório (a missão da fila é o que `applyMissionResult` consome). */
function applyReport(c: Contract, report: QualityReport, isReplay = false): boolean {
  const mission = {
    id: report.missionId,
    contractId: c.id,
    status: 'PENDING_PROCESSING',
    isReplay,
    plan: { lines: [], params: { aircraftId: c.referencePlan.aircraftId } },
  } as unknown as MissionData;
  useGameStore.setState((s) => ({
    mission: { ...s.mission, pending: [...s.mission.pending, mission] },
  }));
  return get().applyMissionResult(report);
}

function buyableCollection(): string[] {
  const state = get();
  return COLLECTION.filter(
    (id) =>
      canBuy(shopItem(id), {
        money: state.player.money,
        inventory: state.inventory,
        unlock: unlockStateFrom(state),
        shopPriceMod: 1,
      }).ok,
  );
}

/** Roda a campanha do início: compra o que o plano pede (se der) e conclui cada contrato com o score fixo. */
function simulate(order: readonly string[]): Step[] {
  resetGameStore();
  get().setFlags({ introSeen: true });
  const steps: Step[] = [];
  for (const id of order) {
    const c = getContract(id);
    get().refreshUnlocks({ silent: true });
    const step: Partial<Step> = {
      id,
      statusBefore: get().contracts[id]?.status,
      r10StatusBefore: get().contracts.R10?.status,
      reputationBefore: get().player.reputation,
      moneyBefore: get().player.money,
      bought: [],
      shortfalls: [],
    };
    const mod = selectModifiers(get()).shopPrice;
    for (const item of planItems(c)) {
      if (ownsItem(get().inventory, item)) continue;
      const s = shopItem(item);
      const check = canBuy(s, {
        money: get().player.money,
        inventory: get().inventory,
        unlock: unlockStateFrom(get()),
        shopPriceMod: mod,
      });
      if (!check.ok) {
        step.shortfalls?.push(`${id}: ${item} — ${check.reason}`);
        continue;
      }
      step.bought?.push({ item, priceBRL: shopPrice(s.priceBRL, mod) });
      get().buyItem(item);
    }
    step.moneyAfterPurchases = get().player.money;
    const report = approvedReport(c);
    step.paymentBRL = report.payment.totalBRL;
    applyReport(c, report);
    const state = get();
    Object.assign(step, {
      moneyAfter: state.player.money,
      reputationAfter: state.player.reputation,
      riftsDone: unlockStateFrom(state).riftsDone,
      buyable: buyableCollection(),
      realDone: ['C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06'].filter(
        (rid) => state.contracts[rid]?.status === 'COMPLETED',
      ).length,
      finaleDueAfter: finaleDue(state),
    });
    steps.push(step as Step);
  }
  return steps;
}

describe('campanha simulada (catalog §13, score 0,8, sem renda passiva nem equipe)', () => {
  const steps = simulate([...SCRIPT, ...EPILOGUE]);
  const byId = (id: string) => steps.find((s) => s.id === id) as Step;

  it('a ordem de desbloqueio vale: cada contrato do roteiro está disponível na hora em que é aceito', () => {
    expect(steps.map((s) => s.id)).toEqual([...SCRIPT, ...EPILOGUE]);
    for (const s of steps) expect(s.statusBefore, s.id).toBe('AVAILABLE');
    // Os 7 reais em ordem de campanha (contracts-real §4): C00 → C01 → C05 → C06 → C02 → C04 → C03.
    const real = steps.filter((s) => s.id.startsWith('C')).map((s) => s.id);
    expect(real).toEqual(['C00', 'C01', 'C05', 'C06', 'C02', 'C04', 'C03']);
  });

  it('as reputações mínimas de contracts-real §4 são cumpridas: C06 ≥ 40, C02 ≥ 50, C04 ≥ 55, C03 ≥ 65', () => {
    expect(byId('C06').reputationBefore).toBeGreaterThanOrEqual(40);
    expect(byId('C02').reputationBefore).toBeGreaterThanOrEqual(50);
    expect(byId('C04').reputationBefore).toBeGreaterThanOrEqual(55);
    expect(byId('C03').reputationBefore).toBeGreaterThanOrEqual(65);
    for (const s of steps) {
      expect(s.reputationAfter).toBeGreaterThanOrEqual(0);
      expect(s.reputationAfter).toBeLessThanOrEqual(100);
    }
  });

  it('as compras viáveis: nada falta de dinheiro, e o plano de cada contrato fica completo antes de aceitá-lo', () => {
    expect(steps.flatMap((s) => s.shortfalls)).toEqual([]);
    for (const s of steps) {
      expect(s.moneyAfterPurchases, s.id).toBeGreaterThanOrEqual(0);
      const spent = s.bought.reduce((sum, b) => sum + b.priceBRL, 0);
      expect(s.moneyBefore - spent, s.id).toBe(s.moneyAfterPurchases);
    }
    // O que cada contrato compra: o T1 no C01; o combo T2 e a lente de 24 mm no C06; o T3 e a MS5 no C02;
    // a picape no C04; o pod LiDAR no C03; a câmera térmica na R06.
    const bought = (id: string) => byId(id).bought.map((b) => b.item);
    expect(bought('C00')).toEqual([]);
    expect(bought('C01')).toEqual(['DRONE_T1']);
    expect(bought('C06')).toEqual(['DRONE_T2', 'LENS_24']);
    expect(bought('C02')).toEqual(['VTOL_T3', 'CAM_MS5']);
    expect(bought('C04')).toEqual(['PICKUP_4X4']);
    expect(bought('C03')).toEqual(['POD_LIDAR']);
    expect(bought('R06')).toEqual(['CAM_THERMAL']);
    for (const id of [
      'R01',
      'R02',
      'C05',
      'R07',
      'R08',
      'R11',
      'R09',
      'R03',
      'R05',
      'R04',
      'R10',
    ]) {
      expect(bought(id), id).toEqual([]);
    }
  });

  it('os saldos batem com a tabela de catalog §13, menos os R$ 6.000 da lente de 24 mm que a tabela manual não contou', () => {
    let afterC06 = false;
    for (const id of SCRIPT) {
      if (id === 'C06') afterC06 = true;
      const expected = brl((SPEC_BALANCE_BRL[id] as number) - (afterC06 ? LENS_24_BRL : 0));
      expect(byId(id).moneyAfter, `${id}: ${formatBRL(byId(id).moneyAfter)}`).toBe(expected);
    }
    // O ponto mais apertado é o C01: R$ 7.300 menos o T1 (R$ 6.000) deixam R$ 1.300; o do combo T2, no C06, deixa R$ 3.500.
    const tightest = Math.min(...steps.map((s) => s.moneyAfterPurchases));
    expect(tightest).toBe(brl(1_300));
    expect(byId('C01').moneyAfterPurchases).toBe(tightest);
    expect(byId('C06').moneyAfterPurchases).toBe(brl(3_500));
  });

  it('as fendas abrem na ordem: R01 e R02 com o C01; R07 com o C06; R08 e R11 com o C05; R09 com o C02; R03 e R05 com o C04; R04 com o C03', () => {
    const unlockedBefore = (id: string) => steps.findIndex((s) => s.id === id);
    expect(unlockedBefore('R01')).toBeGreaterThan(unlockedBefore('C01'));
    expect(unlockedBefore('R07')).toBeGreaterThan(unlockedBefore('C06'));
    expect(unlockedBefore('R08')).toBeGreaterThan(unlockedBefore('C05'));
    expect(unlockedBefore('R09')).toBeGreaterThan(unlockedBefore('C02'));
    expect(unlockedBefore('R03')).toBeGreaterThan(unlockedBefore('C04'));
    expect(unlockedBefore('R04')).toBeGreaterThan(unlockedBefore('C03'));
    // As 11 fendas foram descobertas, cada uma com o seu portal.
    expect(get().world.discoveredRifts).toHaveLength(11);
    expect(new Set(get().world.discoveredRifts).size).toBe(11);
  });

  it('a R10 só abre com o C03 e cinco fendas: com cinco fendas e sem o C03 segue bloqueada', () => {
    // Antes do C03 já havia 5 fendas concluídas (R01, R02, R07, R08, R11), e a R10 ainda estava bloqueada.
    expect(byId('R11').riftsDone).toBe(5);
    expect(byId('R11').r10StatusBefore).toBe('LOCKED');
    expect(byId('C03').r10StatusBefore).toBe('LOCKED');
    // Com o C03 feito, a R10 vira disponível.
    expect(
      steps
        .slice(steps.findIndex((s) => s.id === 'C03') + 1)
        .every((s) => s.r10StatusBefore === 'AVAILABLE'),
    ).toBe(true);
  });

  it('cosméticos por coleção: 6 fendas (CHAR_MULTIVERSE), C03 (PAINT_CAMO e ATLAS_LAUREL), os 7 reais (CHAR_GRANDPA_HAT) e 11 fendas (PAINT_HOLO)', () => {
    const firstWith = (cosmetic: string) =>
      steps.find((s) => s.buyable.includes(cosmetic))?.id as string;
    // Com 5 fendas o traje ainda não; a 6ª (a R09, no roteiro) o libera.
    expect(byId('R11').buyable).not.toContain('CHAR_MULTIVERSE');
    expect(byId('R11').riftsDone).toBe(5);
    expect(firstWith('CHAR_MULTIVERSE')).toBe('R09');
    expect(byId('R09').riftsDone).toBe(6);
    // O C03 libera a pintura de camuflagem e a coroa de louros, e fecha os 7 reais (o chapéu do avô).
    for (const id of ['PAINT_CAMO', 'ATLAS_LAUREL', 'CHAR_GRANDPA_HAT']) {
      expect(firstWith(id), id).toBe('C03');
      expect(byId('C04').buyable).not.toContain(id);
    }
    // A pintura holográfica só com as 11 fendas: o último passo (R10).
    expect(firstWith('PAINT_HOLO')).toBe('R10');
    expect(byId('R10').riftsDone).toBe(11);
    expect(byId('R06').buyable).not.toContain('PAINT_HOLO');
    // As condições estão nos dados: cosméticos de graça, só desbloqueados (a camuflagem custa R$ 1.200).
    for (const id of COLLECTION) {
      const c = COSMETICS.find((x) => x.id === id);
      expect(c?.priceBRL, id).toBe(id === 'PAINT_CAMO' ? brl(1_200) : 0);
      expect(c?.unlock, id).toBeDefined();
    }
  });

  it('o final: devido só depois do C03 (os 7 reais), uma única vez, e entrega o chapéu do avô', () => {
    const c03 = steps.findIndex((s) => s.id === 'C03');
    steps.forEach((s, i) => expect(s.finaleDueAfter, s.id).toBe(i >= c03));
    expect(byId('C04').realDone).toBe(6);
    expect(byId('C03').realDone).toBe(7);
    expect(finaleDue(get())).toBe(true);
    expect(ownsItem(get().inventory, FINALE_REWARD)).toBe(false);
    get().completeFinale();
    expect(finaleDue(get())).toBe(false);
    expect(ownsItem(get().inventory, FINALE_REWARD)).toBe(true);
    // Mesmo repetindo o último contrato real, o final não volta.
    applyReport(getContract('C03'), approvedReport(getContract('C03'), true), true);
    expect(finaleDue(get())).toBe(false);
  });
});

describe('replay (REQ-CNT-005): 40 %, sem souvenir e sem roubo', () => {
  beforeEach(() => {
    resetGameStore();
    get().setFlags({ introSeen: true });
    const c00 = getContract('C00');
    applyReport(c00, approvedReport(c00));
  });

  it('o replay do C00 paga 40 % do valor da primeira vez e não dá souvenir nem outro setor', () => {
    const c00 = getContract('C00');
    const first = get().player.money - 500_000;
    expect(first).toBe(brl(2_300));
    expect(get().souvenirs).toEqual([c00.souvenirId]);
    const before = get().player.money;
    const report = approvedReport(c00, true);
    expect(report.payment.replayFactor).toBe(0.4);
    expect(report.souvenirAwarded).toBeUndefined();
    expect(applyReport(c00, report, true)).toBe(true);
    expect(get().player.money - before).toBe(brl(920));
    expect(get().souvenirs).toEqual([c00.souvenirId]);
    expect(get().contracts.C00).toMatchObject({ status: 'COMPLETED', completions: 2 });
    // O XP também é de 40 %.
    expect(report.xp).toBe(Math.round(c00.xp * 0.4 * (0.5 + 0.5 * SCORE)));
  });

  it('falha crítica no replay: perde no máximo 3 de reputação e o contrato não é roubado', () => {
    const c00 = getContract('C00');
    const rep = get().player.reputation;
    const report = approvedReport(c00, true, true);
    expect(report.reputationDelta).toBe(-3);
    expect(applyReport(c00, report, true)).toBe(true);
    expect(get().player.reputation).toBe(rep - 3);
    expect(get().contracts.C00?.status).toBe('COMPLETED');
  });

  it('já fora do replay, a falha crítica perde 10 de reputação (o contrato é roubado se houver outro jogável)', () => {
    const c01 = getContract('C01');
    get().refreshUnlocks({ silent: true });
    const rep = get().player.reputation;
    const report = approvedReport(c01, false, true);
    expect(report.reputationDelta).toBe(-10);
    applyReport(c01, report);
    expect(get().player.reputation).toBe(rep - 10);
    expect(get().contracts.C01?.status).toBe('STOLEN');
  });
});
