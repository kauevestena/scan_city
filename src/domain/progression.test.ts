import { SKILLS } from '@/data/skills';
import { initialInventory } from '@/state/slices/inventorySlice';
import type { SkillNode, UnlockCondition } from '@/types';
import { applyModifiers, MODIFIER_KEYS, neutralModifiers } from './modifiers';
import {
  addXp,
  applyReputation,
  canUnlockSkill,
  describeUnlock,
  evaluateUnlock,
  finaleDue,
  reputationBand,
  scaleReputationGain,
  unlockStateFrom,
  xpToNext,
  type UnlockState,
} from './progression';

describe('níveis', () => {
  it('G19 — xpToNext dos níveis 1..5: 100, 283, 520, 800, 1118', () => {
    expect([1, 2, 3, 4, 5].map(xpToNext)).toEqual([100, 283, 520, 800, 1118]);
  });

  it('XP 90 no nível 1 + 300 → nível 3 com 7 de sobra e 2 pontos (progression §14)', () => {
    const r = addXp({ xp: 90, level: 1, skillPoints: 0 }, 300);
    expect(r).toEqual({ xp: 7, level: 3, skillPoints: 2, levelsGained: 2 });
    expect(addXp({ xp: 0, level: 1, skillPoints: 0 }, 99)).toMatchObject({
      level: 1,
      xp: 99,
      levelsGained: 0,
    });
    expect(addXp({ xp: 0, level: 1, skillPoints: 0 }, -50).xp).toBe(0);
  });

  it('desbloqueio de skill: pontos e pré-requisito', () => {
    const node = (id: string) => SKILLS.find((s) => s.id === id) as SkillNode;
    expect(canUnlockSkill(node('PIL_1'), 1, [])).toBe(true);
    expect(canUnlockSkill(node('PIL_1'), 0, [])).toBe(false);
    expect(canUnlockSkill(node('PIL_2'), 5, [])).toBe(false);
    expect(canUnlockSkill(node('PIL_3'), 1, ['PIL_1', 'PIL_2'])).toBe(false);
    expect(canUnlockSkill(node('PIL_3'), 2, ['PIL_1', 'PIL_2'])).toBe(true);
    expect(canUnlockSkill(node('PIL_1'), 3, ['PIL_1'])).toBe(false);
  });
});

describe('applyModifiers', () => {
  it('cumulativo: PIL_1 + PIL_4 → windDrift 0,6', () => {
    expect(applyModifiers(['PIL_1', 'PIL_4']).windDrift).toBeCloseTo(0.6, 12);
    expect(applyModifiers(['PIL_1', 'PIL_4']).thermalEffect).toBe(0.5);
  });

  it('todos os ramos completos e o operador add', () => {
    const all = applyModifiers(SKILLS.map((s) => s.id));
    expect(all.rmseGlobal).toBeCloseTo(0.765, 12);
    expect(all.rollingShutterPenalty).toBe(0);
    expect(all.contractPayment).toBe(1.25);
    expect(all.rivalChance).toBe(0.5);
    const custom: SkillNode[] = [
      {
        id: 'X',
        branch: 'PILOT',
        rank: 1,
        name: '',
        description: '',
        cost: 1,
        effects: [{ key: 'endurance', op: 'add', value: 0.2 }],
      },
    ];
    expect(applyModifiers(['X', 'Y'], custom).endurance).toBeCloseTo(1.2, 12);
    expect(Object.keys(neutralModifiers())).toEqual([...MODIFIER_KEYS]);
  });
});

describe('evaluateUnlock', () => {
  const state: UnlockState = {
    completedContracts: new Set(['C00', 'C04', 'R01']),
    level: 4,
    reputation: 60,
    ownedItems: new Set(['PICKUP_4X4']),
    riftsDone: 1,
  };

  it('avalia cada tipo, recursivo em ALL/ANY', () => {
    const c03: UnlockCondition = {
      type: 'ALL',
      of: [
        { type: 'CONTRACT_DONE', contractId: 'C04' },
        { type: 'CONTRACT_DONE', contractId: 'C02' },
        { type: 'REPUTATION', min: 65 },
        { type: 'OWNS', itemId: 'PICKUP_4X4' },
      ],
    };
    expect(evaluateUnlock(c03, state)).toBe(false);
    expect(
      evaluateUnlock(c03, {
        ...state,
        reputation: 70,
        completedContracts: new Set(['C04', 'C02']),
      }),
    ).toBe(true);
    expect(evaluateUnlock({ type: 'ALWAYS' }, state)).toBe(true);
    expect(evaluateUnlock({ type: 'LEVEL', min: 5 }, state)).toBe(false);
    expect(evaluateUnlock({ type: 'RIFTS_DONE', count: 1 }, state)).toBe(true);
    const nested: UnlockCondition = {
      type: 'ANY',
      of: [
        { type: 'LEVEL', min: 99 },
        {
          type: 'ALL',
          of: [
            { type: 'REPUTATION', min: 50 },
            { type: 'CONTRACT_DONE', contractId: 'C00' },
          ],
        },
      ],
    };
    expect(evaluateUnlock(nested, state)).toBe(true);
    expect(describeUnlock(nested)).toBe('nível 99 ou reputação 50 e concluir o contrato C00');
    expect(describeUnlock({ type: 'ALWAYS' })).toBe('Disponível');
    expect(describeUnlock({ type: 'RIFTS_DONE', count: 6 })).toBe('6 fendas concluídas');
    expect(describeUnlock({ type: 'OWNS', itemId: 'PICKUP_4X4' }, () => 'Picape')).toBe(
      'possuir Picape',
    );
  });

  it('estado a partir do save', () => {
    const s = unlockStateFrom({
      contracts: {
        C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 },
        C05: { status: 'STOLEN', completions: 1, bestScore: 0.5 },
        R02: { status: 'COMPLETED', completions: 1, bestScore: 0.9 },
        C01: { status: 'AVAILABLE', completions: 0, bestScore: 0 },
      },
      player: { name: 'x', money: 0, xp: 0, level: 2, skillPoints: 0, reputation: 41 },
      inventory: initialInventory(),
    });
    expect([...s.completedContracts].sort()).toEqual(['C00', 'C05', 'R02']);
    expect(s.riftsDone).toBe(1);
    expect(s.ownedItems.has('ATLAS')).toBe(true);
    expect(s.ownedItems.has('OLD_LAPTOP')).toBe(true);
    expect(s).toMatchObject({ level: 2, reputation: 41 });
  });
});

describe('finaleDue (REQ-CNT-008)', () => {
  const REAL = ['C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06'];
  const done = (ids: string[]) =>
    Object.fromEntries(
      ids.map((id) => [id, { status: 'COMPLETED' as const, completions: 1, bestScore: 0.9 }]),
    );
  const save = (ids: string[], flags: { introSeen: boolean; finaleSeen: boolean }) => ({
    contracts: done(ids),
    player: { level: 1, reputation: 30 } as never,
    inventory: initialInventory(),
    flags: { ...flags, tutorialStep: 0 },
  });

  it('devido só com a intro vista, o final ainda não visto e os 7 contratos reais concluídos', () => {
    expect(finaleDue(save(REAL, { introSeen: true, finaleSeen: false }))).toBe(true);
    // Falta um contrato real.
    expect(finaleDue(save(REAL.slice(1), { introSeen: true, finaleSeen: false }))).toBe(false);
    // As 11 fendas não contam.
    const rifts = Array.from({ length: 11 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`);
    expect(finaleDue(save(rifts, { introSeen: true, finaleSeen: false }))).toBe(false);
    // Sem a intro, ou depois de visto, não.
    expect(finaleDue(save(REAL, { introSeen: false, finaleSeen: false }))).toBe(false);
    expect(finaleDue(save(REAL, { introSeen: true, finaleSeen: true }))).toBe(false);
  });

  it('um contrato concluído e repetido conta como concluído (completions > 0)', () => {
    const s = save(REAL, { introSeen: true, finaleSeen: false });
    s.contracts.C03 = { status: 'AVAILABLE' as never, completions: 2, bestScore: 0.9 };
    expect(finaleDue(s)).toBe(true);
  });
});

describe('reputação (progression §9)', () => {
  it('ganhos × reputationGain, perdas não; clamp 0..100; faixas', () => {
    expect(scaleReputationGain(4, 1.5)).toBe(6);
    expect(scaleReputationGain(-4, 1.5)).toBe(-4);
    expect(applyReputation(98, 5)).toBe(100);
    expect(applyReputation(1, -5)).toBe(0);
    expect([0, 29, 30, 49, 50, 69, 70, 89, 90, 100].map(reputationBand)).toEqual([
      'Desconhecida',
      'Desconhecida',
      'Promissora',
      'Promissora',
      'Respeitada',
      'Respeitada',
      'Referência',
      'Referência',
      'Lendária',
      'Lendária',
    ]);
  });
});
