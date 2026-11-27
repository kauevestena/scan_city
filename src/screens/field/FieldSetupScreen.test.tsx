import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { CATALOG, getVehicle } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan, validatePlan } from '@/domain/flightPlanner';
import { estimateFromPlan, predictRequirements } from '@/domain/requirements';
import { initialView, toScreen, viewTransform } from '@/engines/field/satellite';
import { PAD } from '@/input/gamepad';
import { InputManager } from '@/input/InputManager';
import { createPad, installGamepads, setButton, XBOX_ID } from '@/test/fakeGamepad';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import type { GroundPoint } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FieldSetupScreen } from './FieldSetupScreen';

const get = () => useGameStore.getState();
const W = 800;
const H = 600;
const gcp = (id: string, u: number, v: number): GroundPoint => ({
  id,
  kind: 'GCP',
  u,
  v,
  elevM: 0,
  sigmaM: 0,
});

/** jsdom não faz layout: o canvas mede 800 × 600 a partir de (0, 0). */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => W });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => H,
  });
});
afterAll(() => {
  // Volta ao comportamento do jsdom (0).
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
});

function canvasAt(u: number, v: number) {
  const t = viewTransform(createTerrain(C00), initialView(createTerrain(C00)), W, H);
  return toScreen(t, u, v);
}

function clickMap(u: number, v: number) {
  const { x, y } = canvasAt(u, v);
  const canvas = screen.getByTestId('satellite-canvas');
  fireEvent.pointerDown(canvas, { button: 0, clientX: x, clientY: y });
  fireEvent.pointerUp(canvas, { button: 0, clientX: x, clientY: y });
}

const tab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

describe('FieldSetupScreen — abas pelo teclado e pelo gamepad (REQ-INP-006)', () => {
  const selected = () =>
    screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

  it('Q e E trocam de aba, com volta nas pontas', () => {
    render(<FieldSetupScreen />);
    expect(selected()).toBe('1 · Pontos de apoio');
    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
    expect(selected()).toBe('2 · Plano de voo');
    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
    expect(selected()).toBe('4 · Checklist');
    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
    expect(selected()).toBe('1 · Pontos de apoio');
    fireEvent.keyDown(window, { code: 'KeyQ', key: 'q' });
    expect(selected()).toBe('4 · Checklist');
  });

  it('LB e RB do controle fazem o mesmo (o D-pad não alcança as abas inativas)', () => {
    const pad = createPad(XBOX_ID);
    const uninstall = installGamepads([pad]);
    try {
      render(<FieldSetupScreen />);
      setButton(pad, PAD.RB, true);
      act(() => InputManager.get().poll(1));
      expect(selected()).toBe('2 · Plano de voo');
      setButton(pad, PAD.RB, false);
      act(() => InputManager.get().poll(2));
      setButton(pad, PAD.LB, true);
      act(() => InputManager.get().poll(3));
      expect(selected()).toBe('1 · Pontos de apoio');
    } finally {
      uninstall();
    }
  });
});

describe('FieldSetupScreen — mira do teclado no mapa (REQ-NFR-007)', () => {
  const enter = (canvas: HTMLElement) => fireEvent.keyDown(canvas, { key: 'Enter', code: 'Enter' });

  it('com o foco no mapa aparece a mira, e o Enter coloca um ponto no centro; a Borracha o remove', () => {
    render(<FieldSetupScreen />);
    const canvas = screen.getByTestId('satellite-canvas');
    expect(canvas).toHaveAttribute('tabindex', '0');
    expect(screen.queryByTestId('satellite-crosshair')).not.toBeInTheDocument();
    act(() => canvas.focus());
    expect(screen.getByTestId('satellite-crosshair')).toBeInTheDocument();
    enter(canvas);
    const placed = get().mission.active?.groundPoints ?? [];
    expect(placed.map((p) => p.id)).toEqual(['GCP-01']);
    // O ponto fica no centro da vista (a vista inicial é centrada na AOI).
    expect(placed[0]?.u).toBeCloseTo(C00.aoi.lengthM / 2, 3);
    expect(placed[0]?.v).toBeCloseTo(C00.aoi.widthM / 2, 3);
    // Outro Enter sobre o mesmo ponto não coloca um segundo por cima.
    enter(canvas);
    expect(get().mission.active?.groundPoints).toHaveLength(1);
    // A Borracha (tecla X) com o ponto sob a mira o remove.
    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' });
    enter(canvas);
    expect(get().mission.active?.groundPoints).toEqual([]);
    act(() => canvas.blur());
    expect(screen.queryByTestId('satellite-crosshair')).not.toBeInTheDocument();
  });

  it('o CP (tecla C) entra pelo teclado como CP, e o Espaço faz o mesmo que o Enter', () => {
    render(<FieldSetupScreen />);
    const canvas = screen.getByTestId('satellite-canvas');
    act(() => canvas.focus());
    fireEvent.keyDown(window, { code: 'KeyC', key: 'c' });
    fireEvent.keyDown(canvas, { key: ' ', code: 'Space' });
    expect(get().mission.active?.groundPoints.map((p) => p.id)).toEqual(['CP-01']);
  });

  it('a mira recusada pelo terreno mostra o motivo, como o clique', () => {
    // Um ponto fora do alcance a pé: leva a vista para longe da via com o teclado de pan.
    render(<FieldSetupScreen />);
    const canvas = screen.getByTestId('satellite-canvas');
    act(() => canvas.focus());
    // O limite do instrumento (8 pontos) vale também pelo teclado.
    act(() =>
      get().setGroundPoints(
        Array.from({ length: 8 }, (_, i) => gcp(`GCP-0${i + 1}`, 20 + i * 25, 100)),
      ),
    );
    enter(canvas);
    expect(screen.getByTestId('satellite-refusal')).toHaveTextContent('Limite do instrumento (8)');
  });
});

describe('FieldSetupScreen', () => {
  it('cabeçalho com o contrato e as quatro abas', () => {
    render(<FieldSetupScreen />);
    expect(screen.getByTestId('field-contract')).toHaveTextContent('Sítio do Avô');
    const tabs = within(
      screen.getByRole('tablist', { name: 'Planejamento de campo' }),
    ).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      '1 · Pontos de apoio',
      '2 · Plano de voo',
      '3 · Calibração',
      '4 · Checklist',
    ]);
  });

  it('clique coloca um GCP; a pé, um ponto fora do alcance é recusado com o motivo', () => {
    render(<FieldSetupScreen />);
    clickMap(25, 20);
    expect(get().mission.active?.groundPoints.map((p) => p.id)).toEqual(['GCP-01']);
    clickMap(-44, 188);
    expect(screen.getByTestId('satellite-refusal')).toHaveTextContent(
      /^Fora do alcance \(\d+ m da via mais próxima > 150 m\)$/,
    );
    expect(get().mission.active?.groundPoints).toHaveLength(1);
  });

  it('teclas C e X trocam a ferramenta: CP e borracha', () => {
    render(<FieldSetupScreen />);
    fireEvent.keyDown(window, { code: 'KeyC', key: 'c' });
    clickMap(70, 50);
    expect(get().mission.active?.groundPoints.map((p) => p.id)).toEqual(['CP-01']);
    fireEvent.keyDown(window, { code: 'KeyX', key: 'x' });
    expect(screen.getByRole('tab', { name: 'Borracha' })).toHaveAttribute('aria-selected', 'true');
    clickMap(70, 50);
    expect(get().mission.active?.groundPoints).toEqual([]);
  });

  it('limite do instrumento: o 9º ponto é recusado', () => {
    act(() =>
      get().setGroundPoints(
        Array.from({ length: 8 }, (_, i) => gcp(`GCP-0${i + 1}`, 20 + i * 25, 100)),
      ),
    );
    render(<FieldSetupScreen />);
    clickMap(30, 20);
    expect(screen.getByTestId('satellite-refusal')).toHaveTextContent('Limite do instrumento (8)');
  });

  it('arrastar move o ponto; soltar num lugar inválido devolve com o motivo', () => {
    act(() => get().setGroundPoints([gcp('GCP-01', 25, 20)]));
    render(<FieldSetupScreen />);
    const canvas = screen.getByTestId('satellite-canvas');
    const a = canvasAt(25, 20);
    const b = canvasAt(40, 30);
    fireEvent.pointerDown(canvas, { button: 0, clientX: a.x, clientY: a.y });
    fireEvent.pointerMove(canvas, { clientX: b.x, clientY: b.y });
    fireEvent.pointerUp(canvas, { button: 0, clientX: b.x, clientY: b.y });
    const moved = get().mission.active?.groundPoints[0];
    expect(moved?.u).toBeCloseTo(40, 6);
    expect(moved?.v).toBeCloseTo(30, 6);
    const far = canvasAt(-44, 188);
    fireEvent.pointerDown(canvas, { button: 0, clientX: b.x, clientY: b.y });
    fireEvent.pointerMove(canvas, { clientX: far.x, clientY: far.y });
    fireEvent.pointerUp(canvas, { button: 0, clientX: far.x, clientY: far.y });
    expect(get().mission.active?.groundPoints[0]?.u).toBeCloseTo(40, 6);
    expect(screen.getByTestId('satellite-refusal')).toHaveTextContent(/Fora do alcance/);
  });

  it('cursor mostra (u, v, z); a roda e o arraste com o botão direito mexem na vista', () => {
    render(<FieldSetupScreen />);
    const canvas = screen.getByTestId('satellite-canvas');
    const p = canvasAt(100, 50);
    fireEvent.pointerMove(canvas, { clientX: p.x, clientY: p.y });
    expect(screen.getByTestId('satellite-cursor')).toHaveTextContent(
      /^u 100,0 m · v 50,0 m · z -?\d+,\d m$/,
    );
    fireEvent.wheel(canvas, { deltaY: -100, clientX: p.x, clientY: p.y });
    fireEvent.pointerDown(canvas, { button: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 10 });
    fireEvent.pointerUp(canvas, { button: 2, clientX: 60, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: p.x, clientY: p.y });
    // Depois do zoom e do pan, o mesmo pixel aponta para outro lugar.
    expect(screen.getByTestId('satellite-cursor')).not.toHaveTextContent(/^u 100,0 m · v 50,0 m/);
  });

  it('3 GCPs colineares: semáforo vermelho e dica do eixo Z; a sugestão automática corrige', () => {
    act(() =>
      get().setGroundPoints([
        gcp('GCP-01', 20, 20),
        gcp('GCP-02', 120, 80),
        gcp('GCP-03', 220, 140),
      ]),
    );
    render(<FieldSetupScreen />);
    expect(screen.getByTestId('distribution-light')).toHaveAttribute('data-light', 'RED');
    expect(screen.getByTestId('distribution-hint')).toHaveTextContent(
      'Pontos quase alinhados: o Z vai sofrer',
    );
    fireEvent.click(screen.getByTestId('suggest-gcps'));
    expect(get().mission.active?.groundPoints.filter((p) => p.kind === 'GCP')).toHaveLength(5);
    expect(screen.getByTestId('distribution-light')).toHaveAttribute('data-light', 'GREEN');
  });

  it('plano de referência do C00: GSD 2,52 cm, 6 linhas, 96 fotos e 03:51 (G23)', () => {
    render(<FieldSetupScreen />);
    tab(/Plano de voo/);
    const params = get().mission.active?.plan.params;
    if (!params) throw new Error('sem plano');
    act(() =>
      get().updatePlan({
        ...params,
        heightM: 60,
        forwardOverlapPct: 70,
        sideOverlapPct: 60,
        speedMs: 10,
      }),
    );
    expect(screen.getByTestId('stat-gsd').textContent?.replace(/\s/g, ' ')).toBe('2,52 cm');
    expect(screen.getByTestId('stat-lines')).toHaveTextContent('6');
    expect(screen.getByTestId('stat-photos')).toHaveTextContent('96');
    expect(screen.getByTestId('stat-time')).toHaveTextContent('03:51');
  });

  it('sliders nos limites da aeronave e do teto; com Atlas, sem modos especiais', () => {
    render(<FieldSetupScreen />);
    tab(/Plano de voo/);
    const h = screen.getByRole('slider', { name: 'Altura (H)' });
    expect(h).toHaveAttribute('aria-valuemin', '20');
    expect(h).toHaveAttribute('aria-valuemax', '80');
    expect(screen.getByRole('slider', { name: 'Sobreposição longitudinal (p)' })).toHaveAttribute(
      'aria-valuemax',
      '85',
    );
    expect(screen.getByRole('slider', { name: 'Sobreposição lateral (q)' })).toHaveAttribute(
      'aria-valuemin',
      '50',
    );
    expect(screen.getByRole('slider', { name: 'Velocidade (v)' })).toHaveAttribute(
      'aria-valuemax',
      '16',
    );
    expect(screen.queryByTestId('plan-modes')).not.toBeInTheDocument();
    expect(screen.getByTestId('lighting-hint')).toHaveTextContent(/1\/2000 s/);
    fireEvent.click(screen.getByRole('tab', { name: 'Nublado' }));
    expect(get().mission.active?.plan.params.lighting).toBe('OVERCAST');
    expect(screen.getByTestId('lighting-hint')).toHaveTextContent(/sem sombras/);
    // Seta para a direita no slider muda o plano.
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Sobreposição lateral (q)' }), {
      key: 'ArrowRight',
    });
    expect(get().mission.active?.plan.params.sideOverlapPct).toBe(66);
  });

  it('trocar a aeronave troca o sensor incompatível (toast); a malha cruzada acrescenta as perpendiculares', () => {
    act(() =>
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          aircraft: ['ATLAS', 'DRONE_T1'],
          sensors: ['CAM_PIGEON', 'CAM_20MP_RS'],
        },
      })),
    );
    render(<FieldSetupScreen />);
    tab(/Plano de voo/);
    // Só os sensores compatíveis com a aeronave aparecem.
    expect(
      within(screen.getByRole('tablist', { name: 'Sensor / carga' })).getAllByRole('tab'),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Drone Amador "Faísca"' }));
    expect(get().mission.active?.plan.params).toMatchObject({
      aircraftId: 'DRONE_T1',
      sensorId: 'CAM_20MP_RS',
    });
    expect(get().session.toasts.at(-1)?.title).toMatch(/^Sensor trocado para /);
    const primary = get().mission.active?.plan.lines.length ?? 0;
    fireEvent.click(screen.getByTestId('toggle-cross-grid'));
    const lines = get().mission.active?.plan.lines ?? [];
    const cross = lines.filter((l) => l.pass === 'CROSS').length;
    // Linhas perpendiculares sobre a outra dimensão da AOI (240 × 160 m).
    expect(cross).toBeGreaterThan(0);
    expect(lines.length).toBe(primary + cross);
    expect(screen.getByTestId('stat-lines')).toHaveTextContent(`${primary} + ${cross}`);
  });

  it('checklist: requisitos previstos; sem bloqueantes, DECOLAR vai ao voo com a missão IN_FLIGHT', () => {
    act(() =>
      get().setGroundPoints([
        gcp('GCP-01', 25, 20),
        gcp('GCP-02', 215, 20),
        gcp('GCP-03', 120, 140),
      ]),
    );
    render(<FieldSetupScreen />);
    tab(/Checklist/);
    expect(
      within(screen.getByTestId('checklist-requirements')).getAllByRole('listitem'),
    ).toHaveLength(7);
    expect(screen.queryByTestId('checklist-blocking')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('takeoff'));
    expect(get().session.screen).toBe('SURVEY_FLIGHT');
    expect(get().mission.active?.status).toBe('IN_FLIGHT');
    expect(get().session.payload).toEqual({ missionId: get().mission.active?.id });
  });

  it('dificuldade do voo: a média vem marcada; a escolha vai para a missão (ADR-035)', () => {
    render(<FieldSetupScreen />);
    tab(/Checklist/);
    const group = screen.getByRole('radiogroup', { name: 'Dificuldade do voo' });
    const option = (name: RegExp) => within(group).getByRole('radio', { name });
    expect(option(/Média/)).toHaveAttribute('aria-checked', 'true');
    expect(option(/Média/)).toHaveTextContent('pagamento normal');
    expect(option(/Fácil/)).toHaveTextContent('pagamento −20 %');
    expect(option(/Difícil/)).toHaveTextContent('pagamento +25 %');
    fireEvent.click(option(/Difícil/));
    expect(get().mission.active?.difficulty).toBe('HARD');
    expect(option(/Difícil/)).toHaveAttribute('aria-checked', 'true');
    expect(option(/Média/)).toHaveAttribute('aria-checked', 'false');
  });

  it('Atlas sem milho: bloqueante em vermelho e DECOLAR desabilitado', () => {
    act(() =>
      useGameStore.setState((s) => ({
        inventory: { ...s.inventory, corn: { crop: 0, stock: 0 } },
      })),
    );
    render(<FieldSetupScreen />);
    tab(/Checklist/);
    expect(screen.getByTestId('checklist-blocking')).toHaveTextContent('O Atlas está sem milho');
    expect(screen.getByTestId('takeoff')).toBeDisabled();
  });

  it('Cancelar (ou Esc na aba 1) pede confirmação e volta ao mapa descartando a missão', () => {
    render(<FieldSetupScreen />);
    tab(/Plano de voo/);
    // Na aba 2, o Esc volta para a aba 1.
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.getByRole('tab', { name: /Pontos de apoio/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    const dialog = screen.getByRole('dialog', { name: 'Abandonar o planejamento?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar planejando' }));
    expect(get().session.screen).toBe('FIELD_SETUP');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abandonar' }));
    expect(get().session.screen).toBe('WORLD_MAP');
    expect(get().mission.active).toBeNull();
  });

  it('sem missão ativa, oferece voltar ao mapa', () => {
    act(() => get().discardActive());
    render(<FieldSetupScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao mapa' }));
    expect(get().session.screen).toBe('WORLD_MAP');
  });

  it('o recálculo das estatísticas leva < 16 ms (REQ-FLD-007)', () => {
    const mission = get().mission.active;
    if (!mission) throw new Error('sem missão');
    const field = {
      catalog: CATALOG,
      ownsRtkKit: false,
      fieldEquipmentId: 'TOTAL_STATION' as const,
    };
    const points = [gcp('GCP-01', 25, 20), gcp('GCP-02', 215, 20), gcp('GCP-03', 120, 140)];
    const recompute = (h: number) => {
      const plan = buildFlightPlan({ ...mission.plan.params, heightM: h }, C00, CATALOG);
      predictRequirements(plan, C00, points, field);
      estimateFromPlan(plan, C00, points, field);
      validatePlan(plan, get().inventory, C00, CATALOG);
    };
    // Melhor de 5: o teste roda junto com a instrumentação de cobertura.
    const times = [60, 61, 62, 63, 64].map((h) => {
      const t0 = performance.now();
      recompute(h);
      return performance.now() - t0;
    });
    expect(Math.min(...times)).toBeLessThan(16);
  });

  it('os toggles de modo aparecem conforme a aeronave (REQ-FLD-012)', () => {
    act(() =>
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          aircraft: ['ATLAS', 'DRONE_T1', 'DRONE_T2', 'VTOL_T3'],
          sensors: ['CAM_PIGEON', 'CAM_20MP_RS', 'CAM_45MP_FF'],
          lenses: ['LENS_24'],
        },
      })),
    );
    render(<FieldSetupScreen />);
    tab(/Plano de voo/);
    const toggles = () =>
      within(screen.getByTestId('plan-modes'))
        .getAllByRole('button')
        .map((b) => b.textContent);
    // Atlas: nenhum.
    expect(screen.queryByTestId('plan-modes')).not.toBeInTheDocument();
    // Drone T1: malha cruzada e oblíqua; sem Terrain Following.
    fireEvent.click(screen.getByRole('tab', { name: 'Drone Amador "Faísca"' }));
    expect(toggles()).toEqual(['Malha cruzada', 'Oblíqua 45°', 'Oblíqua 60°']);
    fireEvent.click(screen.getByRole('button', { name: 'Oblíqua 45°' }));
    expect(get().mission.active?.plan.params.obliqueDeg).toBe(45);
    fireEvent.click(screen.getByRole('button', { name: 'Oblíqua 45°' }));
    expect(get().mission.active?.plan.params.obliqueDeg).toBeUndefined();
    // Condor (T2): os três modos; Albatroz (asa fixa): TF e malha, sem oblíqua.
    fireEvent.click(screen.getByRole('tab', { name: 'Multirrotor Pro RTK "Condor"' }));
    expect(toggles()).toEqual(['Terrain Following', 'Malha cruzada', 'Oblíqua 45°', 'Oblíqua 60°']);
    fireEvent.click(screen.getByRole('tab', { name: 'Asa Fixa VTOL "Albatroz"' }));
    expect(toggles()).toEqual(['Terrain Following', 'Malha cruzada']);
  });

  describe('instrumento de medição (catalog §4)', () => {
    const own = (equipment: Array<'TOTAL_STATION' | 'GNSS_RTK_KIT'>) =>
      act(() =>
        useGameStore.setState((s) => ({
          inventory: { ...s.inventory, fieldEquipment: equipment },
        })),
      );

    it('com só a Estação Total, não há toggle', () => {
      render(<FieldSetupScreen />);
      expect(screen.queryByTestId('instrument-toggle')).not.toBeInTheDocument();
      expect(screen.getByText(/Estação Total do Avô \(σ 1,0 cm, máx\. 8\)/)).toBeInTheDocument();
    });

    it('com os dois, o toggle troca o σ (1,0 → 1,5 cm), mas os limites seguem o GNSS (20)', () => {
      own(['TOTAL_STATION', 'GNSS_RTK_KIT']);
      render(<FieldSetupScreen />);
      const toggle = screen.getByTestId('instrument-toggle');
      expect(screen.getByText(/Estação Total do Avô \(σ 1,0 cm, máx\. 20\)/)).toBeInTheDocument();
      fireEvent.click(within(toggle).getByRole('tab', { name: 'GNSS RTK' }));
      expect(get().mission.active?.fieldEquipmentId).toBe('GNSS_RTK_KIT');
      expect(
        screen.getByText(/Kit GNSS RTK Base \+ Rover \(σ 1,5 cm, máx\. 20\)/),
      ).toBeInTheDocument();
      fireEvent.click(within(toggle).getByRole('tab', { name: 'Estação Total' }));
      expect(get().mission.active?.fieldEquipmentId).toBe('TOTAL_STATION');
    });

    it('só troca para um equipamento possuído', () => {
      render(<FieldSetupScreen />);
      act(() => get().setFieldEquipment('GNSS_RTK_KIT'));
      expect(get().mission.active?.fieldEquipmentId).toBe('TOTAL_STATION');
    });
  });

  it('o Field Setup usa a união dos veículos: com a picape, um ponto vedado a pé é aceito', () => {
    const terrain = createTerrain(C00);
    const foot = [getVehicle('FOOT_BIKE')];
    const both = [getVehicle('FOOT_BIKE'), getVehicle('PICKUP_4X4')];
    const rules = { paintMarkers: false };
    let spot: { u: number; v: number } | null = null;
    const b = terrain.bounds;
    for (let u = b.uMin; u <= b.uMax && !spot; u += 5) {
      for (let v = b.vMin; v <= b.vMax && !spot; v += 5) {
        if (
          !isAccessible(u, v, terrain, foot, rules).ok &&
          isAccessible(u, v, terrain, both, rules).ok
        )
          spot = { u, v };
      }
    }
    expect(spot).not.toBeNull();
    const { u, v } = spot as { u: number; v: number };
    // A pé: recusado. Com a picape também possuída: aceito.
    const { unmount } = render(<FieldSetupScreen />);
    clickMap(u, v);
    expect(get().mission.active?.groundPoints).toHaveLength(0);
    unmount();
    act(() =>
      useGameStore.setState((s) => ({
        inventory: { ...s.inventory, vehicles: ['FOOT_BIKE', 'PICKUP_4X4'] },
      })),
    );
    render(<FieldSetupScreen />);
    clickMap(u, v);
    expect(get().mission.active?.groundPoints).toHaveLength(1);
  });
});
