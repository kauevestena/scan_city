import { act, fireEvent, render, screen } from '@testing-library/react';
import { getFieldEquipment } from '@/data/catalog';
import { gcpSigma } from '@/domain/accuracy';
import { PAD } from '@/input/gamepad';
import { InputManager, type ActionEvent } from '@/input/InputManager';
import { createPad, installGamepads, setButton, XBOX_ID } from '@/test/fakeGamepad';
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

  it('"Calibrar IMU" abre o canvas da lemniscata; um mini-game por vez', () => {
    expect(screen.getByTestId('imu-score')).toHaveTextContent('Sem calibrar');
    expect(screen.getByTestId('imu-drift')).toHaveTextContent('Deriva giroscópica: 20,0 °/h');
    fireEvent.click(screen.getByRole('button', { name: 'Calibrar IMU' }));
    expect(screen.getByTestId('imu-game')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Curva em forma de 8/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nivelar instrumento' }));
    expect(screen.queryByTestId('imu-game')).not.toBeInTheDocument();
    expect(screen.getByTestId('bubble-game')).toBeInTheDocument();
  });

  it('o imuScore guardado baixa a leitura de deriva e vale o melhor resultado', () => {
    act(() => get().recordMinigame('imu', 0.9));
    expect(screen.getByTestId('imu-score')).toHaveTextContent('IMU: 90 %');
    expect(screen.getByTestId('imu-drift')).toHaveTextContent('Deriva giroscópica: 5,6 °/h');
    act(() => get().recordMinigame('imu', 0.3));
    expect(get().mission.active?.minigames.imuScore).toBe(0.9);
  });
});

describe('aba 3 — a camada de input dos mini-games (REQ-FLD-010, REQ-FLD-011, ADR-038)', () => {
  const input = () => InputManager.get();
  const openLevel = () => screen.getByRole('button', { name: 'Nivelar instrumento' });

  it('com um mini-game aberto o contexto efetivo é MINIGAME; a troca entre eles o mantém', () => {
    expect(input().context).toBe('FIELD');
    fireEvent.click(openLevel());
    expect(input().context).toBe('MINIGAME');
    fireEvent.click(screen.getByRole('button', { name: 'Calibrar IMU' }));
    expect(screen.getByTestId('imu-game')).toBeInTheDocument();
    expect(input().context).toBe('MINIGAME');
  });

  it('o D-pad e as setas chegam ao MOVE do jogo e não movem o foco da tela', () => {
    const pad = createPad(XBOX_ID);
    const uninstall = installGamepads([pad]);
    try {
      const imuButton = screen.getByRole('button', { name: 'Calibrar IMU' });
      fireEvent.click(openLevel());
      act(() => imuButton.focus());
      setButton(pad, PAD.DPAD_RIGHT, true);
      act(() => input().poll(1));
      expect(input().axis('MOVE_X')).toBe(1);
      setButton(pad, PAD.DPAD_UP, true);
      act(() => input().poll(2));
      expect(input().axis('MOVE_Y')).toBe(1);
      expect(document.activeElement).toBe(imuButton);
      setButton(pad, PAD.DPAD_RIGHT, false);
      setButton(pad, PAD.DPAD_UP, false);
      act(() => input().poll(3));
      expect(input().axis('MOVE_X')).toBe(0);
    } finally {
      uninstall();
    }
    fireEvent.keyDown(window, { code: 'ArrowLeft', key: 'ArrowLeft' });
    expect(input().axis('MOVE_X')).toBe(-1);
    fireEvent.keyUp(window, { code: 'ArrowLeft', key: 'ArrowLeft' });
    expect(input().axis('MOVE_X')).toBe(0);
  });

  it('o analógico esquerdo chega ao MOVE que a bolha lê', () => {
    const pad = createPad(XBOX_ID);
    const uninstall = installGamepads([pad]);
    try {
      fireEvent.click(openLevel());
      pad.axes[0] = 1;
      act(() => input().poll(1));
      expect(input().axis('MOVE_X')).toBeCloseTo(1, 6);
      // MOVE_Y é positivo para cima (o analógico para cima dá −1 no eixo 1).
      pad.axes[0] = 0;
      pad.axes[1] = -1;
      act(() => input().poll(2));
      expect(input().axis('MOVE_X')).toBe(0);
      expect(input().axis('MOVE_Y')).toBeCloseTo(1, 6);
    } finally {
      uninstall();
    }
  });

  it('o B do controle interrompe o jogo sem pontuar e devolve o foco ao botão', () => {
    const pad = createPad(XBOX_ID);
    const uninstall = installGamepads([pad]);
    try {
      fireEvent.click(openLevel());
      expect(screen.getByTestId('bubble-game')).toBeInTheDocument();
      setButton(pad, PAD.B, true);
      act(() => input().poll(1));
      expect(screen.queryByTestId('bubble-game')).not.toBeInTheDocument();
      expect(get().mission.active?.minigames.levelScore).toBeUndefined();
      expect(screen.getByTestId('level-score')).toHaveTextContent('Sem nivelar');
      expect(screen.queryByTestId('level-outcome')).not.toBeInTheDocument();
      // Continua na aba da calibração, com o foco no botão do jogo.
      expect(screen.getByTestId('calibration-tab')).toBeInTheDocument();
      expect(document.activeElement).toBe(openLevel());
      expect(input().context).toBe('FIELD');
    } finally {
      uninstall();
    }
  });

  it('o Esc interrompe a lemniscata em vez de pausar; fora do jogo, o Esc volta uma aba', () => {
    const actions: ActionEvent[] = [];
    const off = input().onAction((e) => actions.push(e));
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Calibrar IMU' }));
      expect(screen.getByTestId('imu-game')).toBeInTheDocument();
      fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
      fireEvent.keyUp(window, { code: 'Escape', key: 'Escape' });
      expect(screen.queryByTestId('imu-game')).not.toBeInTheDocument();
      expect(get().mission.active?.minigames.imuScore).toBeUndefined();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Calibrar IMU' }));
      expect(actions.map((e) => e.action)).not.toContain('PAUSE');
      // Sem jogo aberto, o Voltar é o da tela de campo de novo.
      fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
      expect(screen.queryByTestId('calibration-tab')).not.toBeInTheDocument();
    } finally {
      off();
    }
  });
});
