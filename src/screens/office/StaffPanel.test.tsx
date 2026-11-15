import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AudioEngine } from '@/audio/AudioEngine';
import { brl } from '@/data/catalog/money';
import { C00 } from '@/data/contracts';
import { useGameStore } from '@/state/store';
import { syntheticMission } from '@/test/fixtures/syntheticMission';
import { resetGameStore } from '@/test/resetStore';
import { createTerrain } from '@/world/terrain/createTerrain';
import { evaluateForState } from '../processing/evaluate';
import { StaffPanel } from './StaffPanel';

const get = () => useGameStore.getState();
const setMoney = (cents: number) =>
  act(() => useGameStore.setState((s) => ({ player: { ...s.player, money: cents } })));
const role = (id: string) => screen.getByTestId(`staff-${id}`);
const hire = (id: string) =>
  fireEvent.click(within(role(id)).getByRole('button', { name: 'Contratar' }));
const fire = (id: string) =>
  fireEvent.click(within(role(id)).getByRole('button', { name: 'Demitir' }));

beforeEach(() => {
  resetGameStore();
  render(<StaffPanel onClose={() => undefined} />);
});

describe('StaffPanel — contratar e demitir com limites', () => {
  it('mostra as duas funções com custo, bônus e quantidade atual / máxima', () => {
    expect(screen.getByTestId('staff-count-INTERN')).toHaveTextContent('0 / 3');
    expect(screen.getByTestId('staff-count-JUNIOR_ENG')).toHaveTextContent('0 / 2');
    expect(role('INTERN')).toHaveTextContent('Contratação: R$');
    expect(role('INTERN')).toHaveTextContent('Pagamento: +6 %');
    expect(role('INTERN')).toHaveTextContent('Processamento: +5 %');
    expect(role('JUNIOR_ENG')).toHaveTextContent('Pagamento: +15 %');
    expect(within(role('INTERN')).getByRole('button', { name: 'Demitir' })).toBeDisabled();
  });

  it('contratar debita o custo, soma 1 e toca CASH_REGISTER', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setMoney(brl(10_000));
    hire('INTERN');
    expect(get().staff.INTERN).toBe(1);
    expect(get().player.money).toBe(brl(10_000) - brl(1_500));
    expect(screen.getByTestId('staff-count-INTERN')).toHaveTextContent('1 / 3');
    expect(play).toHaveBeenCalledWith('CASH_REGISTER');
    expect(get().session.transactions.at(-1)).toMatchObject({ amount: -brl(1_500) });
  });

  it('no máximo, o botão Contratar desabilita e a função mostra que está completa', () => {
    setMoney(brl(100_000));
    hire('JUNIOR_ENG');
    hire('JUNIOR_ENG');
    expect(get().staff.JUNIOR_ENG).toBe(2);
    expect(within(role('JUNIOR_ENG')).getByRole('button', { name: 'Contratar' })).toBeDisabled();
    expect(role('JUNIOR_ENG')).toHaveTextContent('Equipe completa nesta função');
    // A ação também recusa além do máximo, sem cobrar.
    const money = get().player.money;
    expect(get().hireStaff('JUNIOR_ENG')).toBe(false);
    expect(get().player.money).toBe(money);
    expect(get().staff.JUNIOR_ENG).toBe(2);
  });

  it('sem saldo: DENIED, aviso do que falta e ninguém contratado', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setMoney(brl(1_000));
    hire('INTERN');
    expect(get().staff.INTERN).toBe(0);
    expect(get().player.money).toBe(brl(1_000));
    expect(play).toHaveBeenCalledWith('DENIED');
    expect(get().session.toasts.at(-1)?.title).toMatch(/Saldo insuficiente/);
  });

  it('demitir tira 1, sem custo nem reembolso; com 0 pessoas, o botão fica desabilitado', () => {
    setMoney(brl(10_000));
    hire('INTERN');
    hire('INTERN');
    const money = get().player.money;
    fire('INTERN');
    expect(get().staff.INTERN).toBe(1);
    expect(get().player.money).toBe(money);
    fire('INTERN');
    expect(within(role('INTERN')).getByRole('button', { name: 'Demitir' })).toBeDisabled();
    expect(get().fireStaff('INTERN')).toBe(false);
    expect(get().staff.INTERN).toBe(0);
  });
});

describe('equipe → pagamento e velocidade (progression §7)', () => {
  const mission = () => ({
    ...syntheticMission(C00, createTerrain(C00)),
    status: 'PENDING_PROCESSING' as const,
  });

  it('o custo por contrato e o bônus entram no pagamento; a esteira fica mais rápida', () => {
    const m = mission();
    const none = evaluateForState(get(), m, false);
    expect(none.payment.staffBonus).toBe(1);
    expect(none.payment.staffCostBRL).toBe(0);
    setMoney(brl(100_000));
    hire('INTERN');
    hire('JUNIOR_ENG');
    const staffed = evaluateForState(get(), m, false);
    expect(staffed.payment.staffBonus).toBeCloseTo(1 + 0.06 + 0.15, 12);
    expect(staffed.payment.staffCostBRL).toBe(brl(500) + brl(1_800));
    // Velocidade: 1 + 0,05 + 0,10.
    expect(staffed.processingTimeS).toBeCloseTo(none.processingTimeS / 1.15, 9);
    expect(staffed.payment.totalBRL).toBe(
      Math.max(
        0,
        Math.round(
          none.payment.baseBRL * staffed.payment.qualityFactor * staffed.payment.staffBonus,
        ) - staffed.payment.staffCostBRL,
      ),
    );
  });
});
