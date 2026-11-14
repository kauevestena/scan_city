import { act, fireEvent, render, screen } from '@testing-library/react';
import { getFieldEquipment } from '@/data/catalog';
import { gcpSigma } from '@/domain/accuracy';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { FieldSetupScreen } from './FieldSetupScreen';

const get = () => useGameStore.getState();
const cm = (n: number) => n.toFixed(1).replace('.', ',');

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 600,
  });
});
afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 0 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 0,
  });
});

beforeEach(() => {
  resetGameStore();
  act(() => {
    get().goTo('WORLD_MAP');
    get().startMission('C00', 1);
    get().goTo('FIELD_SETUP', { contractId: 'C00', rivalAdjustment: 1 });
  });
  render(<FieldSetupScreen />);
  fireEvent.click(screen.getByRole('tab', { name: /Calibração/ }));
});

const base = () => getFieldEquipment(get().mission.active?.fieldEquipmentId ?? 'TOTAL_STATION');

describe('aba 3 — Calibração (bolha)', () => {
  it('sem jogar: vale o padrão de 50 % e o σ do apoio aparece no texto', () => {
    expect(screen.getByTestId('calibration-tab')).toBeInTheDocument();
    expect(screen.getByTestId('level-score')).toHaveTextContent('Sem nivelar');
    const sigma = gcpSigma(base().sigmaBaseM, base().id, 0.5).xy * 100;
    expect(screen.getByTestId('level-sigma')).toHaveTextContent(
      `Precisão do apoio: σ = ${cm(sigma)} cm`,
    );
  });

  it('o resultado guardado alimenta o σ; vale a melhor pontuação da missão', () => {
    act(() => get().recordMinigame('level', 0.95));
    expect(screen.getByTestId('level-score')).toHaveTextContent('Nivelamento: 95 %');
    const sigma = gcpSigma(base().sigmaBaseM, base().id, 0.95).xy * 100;
    expect(screen.getByTestId('level-sigma')).toHaveTextContent(`σ = ${cm(sigma)} cm`);
    act(() => get().recordMinigame('level', 0.4));
    expect(get().mission.active?.minigames.levelScore).toBe(0.95);
    expect(screen.getByTestId('level-score')).toHaveTextContent('95 %');
  });

  it('"Nivelar instrumento" abre o canvas da bolha', () => {
    expect(screen.queryByTestId('bubble-game')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nivelar instrumento' }));
    expect(screen.getByTestId('bubble-game')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Nível de bolha circular' })).toBeInTheDocument();
  });

  it('o levelScore menor σ vai para os GCPs na decolagem', () => {
    act(() => get().recordMinigame('level', 1));
    act(() => {
      get().setGroundPoints([{ id: 'GCP-01', kind: 'GCP', u: 20, v: 20, elevM: 0, sigmaM: 0 }]);
    });
    const launched = get().launchMission();
    expect(launched?.groundPoints[0]?.sigmaM).toBeCloseTo(base().sigmaBaseM, 10);
  });
});
