import { fireEvent } from '@testing-library/react';
import {
  createPad,
  DUALSENSE_ID,
  installGamepads,
  setButton,
  XBOX_ID,
  type FakePad,
} from '@/test/fakeGamepad';
import { BINDINGS, buttonActionsForKey, isAxisKey } from './bindings';
import { PAD } from './gamepad';
import {
  InputManager,
  keyCode,
  UI_REPEAT_DELAY_MS,
  UI_REPEAT_INTERVAL_MS,
  type ActionEvent,
} from './InputManager';

let input: InputManager;
let uninstall: () => void = () => undefined;
let t = 0;

const poll = () => {
  t += 16;
  input.poll(t);
};
const key = (code: string, type: 'keyDown' | 'keyUp' = 'keyDown', init: KeyboardEventInit = {}) =>
  fireEvent[type](window, { code, ...init });

function withPads(...pads: FakePad[]) {
  uninstall = installGamepads(pads);
}

beforeEach(() => {
  input = InputManager.get();
  t = 0;
});
afterEach(() => uninstall());

describe('Gamepad API indisponível ou bloqueada', () => {
  it('com `getGamepads` lançando (Permissions Policy), o poll não lança e o teclado segue valendo', () => {
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => {
        throw new DOMException('Gamepad API bloqueada', 'SecurityError');
      },
      configurable: true,
    });
    uninstall = () =>
      Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
    input.setContext('OVERWORLD');
    key('KeyD');
    expect(poll).not.toThrow();
    expect(input.axis('MOVE_X')).toBe(1);
    expect(input.activeDevice).toBe('KEYBOARD');
  });

  it('sem `getGamepads` (contexto inseguro), o poll também segue', () => {
    Object.defineProperty(navigator, 'getGamepads', { value: undefined, configurable: true });
    uninstall = () =>
      Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
    input.setContext('OVERWORLD');
    key('KeyA');
    expect(poll).not.toThrow();
    expect(input.axis('MOVE_X')).toBe(-1);
  });
});

describe('teclado', () => {
  it('mapeia teclas para eixos e botões (REQ-INP-001)', () => {
    input.setContext('OVERWORLD');
    key('KeyD');
    key('KeyW');
    poll();
    expect(input.axis('MOVE_X')).toBe(1);
    expect(input.axis('MOVE_Y')).toBe(1);
    key('ArrowLeft');
    poll();
    expect(input.axis('MOVE_X')).toBe(0);
    key('KeyD', 'keyUp');
    poll();
    expect(input.axis('MOVE_X')).toBe(-1);
    key('Space');
    poll();
    expect(input.down('INTERACT')).toBe(true);
    expect(input.down('CYCLE_VEHICLE')).toBe(false);
  });

  it('pressed é a borda de subida do frame; released, a de descida (REQ-INP-005)', () => {
    input.setContext('FLIGHT');
    key('Space');
    poll();
    expect(input.pressed('FIRE')).toBe(true);
    expect(input.down('FIRE')).toBe(true);
    poll();
    expect(input.pressed('FIRE')).toBe(false);
    expect(input.down('FIRE')).toBe(true);
    key('Space', 'keyUp');
    poll();
    expect(input.released('FIRE')).toBe(true);
    expect(input.down('FIRE')).toBe(false);
    poll();
    expect(input.released('FIRE')).toBe(false);
  });

  it('um toque mais curto que um frame ainda gera pressed', () => {
    input.setContext('FLIGHT');
    key('KeyR');
    key('KeyR', 'keyUp');
    poll();
    expect(input.pressed('RTH')).toBe(true);
    expect(input.released('RTH')).toBe(true);
    expect(input.down('RTH')).toBe(false);
  });

  it('o mesmo Tab vale TOGGLE_SENSOR no voo e TOGGLE_DIMENSION no mapa', () => {
    key('Tab');
    input.setContext('FLIGHT');
    poll();
    expect(input.down('TOGGLE_SENSOR')).toBe(true);
    expect(input.down('TOGGLE_DIMENSION')).toBe(false);
    input.setContext('OVERWORLD');
    expect(input.down('TOGGLE_DIMENSION')).toBe(true);
    expect(input.down('TOGGLE_SENSOR')).toBe(false);
  });

  it('ALT_UP/ALT_DOWN vão de 0 a 1', () => {
    input.setContext('FLIGHT');
    key('KeyQ');
    poll();
    expect(input.axis('ALT_UP')).toBe(1);
    expect(input.axis('ALT_DOWN')).toBe(0);
  });

  it('no voo, Q e E também são a tecla da curva de cada lado (ADR-035)', () => {
    input.setContext('FLIGHT');
    key('KeyE');
    poll();
    expect(input.axis('TURN_RIGHT')).toBe(1);
    expect(input.axis('TURN_LEFT')).toBe(0);
    expect(input.axis('ALT_DOWN')).toBe(1);
  });

  it('blur limpa as teclas mantidas', () => {
    input.setContext('OVERWORLD');
    key('KeyD');
    poll();
    fireEvent.blur(window);
    poll();
    expect(input.axis('MOVE_X')).toBe(0);
  });

  it('preventDefault nas teclas do contexto, exceto em campos de texto e na ativação nativa', () => {
    input.setContext('OVERWORLD');
    expect(key('ArrowUp')).toBe(false);
    expect(key('Tab')).toBe(false);
    expect(key('KeyZ')).toBe(true);
    key('ArrowUp', 'keyUp');

    const field = document.createElement('input');
    document.body.appendChild(field);
    expect(fireEvent.keyDown(field, { code: 'KeyW' })).toBe(true);
    poll();
    expect(input.axis('MOVE_Y')).toBe(0);
    field.remove();

    input.setContext('UI');
    const button = document.createElement('button');
    document.body.appendChild(button);
    expect(fireEvent.keyDown(button, { code: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(button, { code: 'Space' })).toBe(true);
    expect(fireEvent.keyDown(button, { code: 'ArrowDown' })).toBe(false);
    button.remove();
  });

  it('keyCode deriva o code de key quando ele vem vazio', () => {
    expect(keyCode({ code: 'KeyW', key: 'z' })).toBe('KeyW');
    expect(keyCode({ code: '', key: 'w' })).toBe('KeyW');
    expect(keyCode({ code: '', key: 'M' })).toBe('KeyM');
    expect(keyCode({ code: '', key: ' ' })).toBe('Space');
    expect(keyCode({ code: '', key: 'Escape' })).toBe('Escape');
    expect(keyCode({ code: '', key: '2' })).toBe('Digit2');
    expect(keyCode({ code: '', key: '+' })).toBe('Equal');
    expect(keyCode({ code: '', key: 'Shift' })).toBe('');
  });
});

describe('gamepad', () => {
  it('deadzone radial no analógico: 0,1 → 0 e 0,575 → 0,5 (REQ-INP-005)', () => {
    const pad = createPad(XBOX_ID);
    withPads(pad);
    input.setContext('OVERWORLD');
    pad.axes = [0.1, 0, 0, 0];
    poll();
    expect(input.axis('MOVE_X')).toBe(0);
    pad.axes = [0.575, 0, 0, 0];
    poll();
    expect(input.axis('MOVE_X')).toBeCloseTo(0.5, 12);
    pad.axes = [0, -0.575, 0, 0];
    poll();
    expect(input.axis('MOVE_Y')).toBeCloseTo(0.5, 12);
  });

  it('gatilho analógico: RT = buttons[7].value com deadzone de 0,05', () => {
    const pad = createPad(XBOX_ID);
    withPads(pad);
    input.setContext('FLIGHT');
    setButton(pad, PAD.RT, 0.04);
    poll();
    expect(input.axis('ALT_UP')).toBe(0);
    setButton(pad, PAD.RT, 0.525);
    setButton(pad, PAD.LT, 1);
    poll();
    expect(input.axis('ALT_UP')).toBeCloseTo(0.5, 12);
    expect(input.axis('ALT_DOWN')).toBe(1);
    // A tecla da curva no controle é o gatilho do mesmo lado (ADR-035).
    expect(input.axis('TURN_RIGHT')).toBeCloseTo(0.5, 12);
    expect(input.axis('TURN_LEFT')).toBe(1);
  });

  it('borda de pressed por frame nos botões', () => {
    const pad = createPad(XBOX_ID);
    withPads(pad);
    input.setContext('FLIGHT');
    setButton(pad, PAD.X, true);
    poll();
    expect(input.pressed('FIRE')).toBe(true);
    poll();
    expect(input.pressed('FIRE')).toBe(false);
    expect(input.down('FIRE')).toBe(true);
    setButton(pad, PAD.X, false);
    poll();
    expect(input.released('FIRE')).toBe(true);
  });

  it('teclado e gamepad somam nos eixos (com clamp) e fazem OR nos botões', () => {
    const pad = createPad(XBOX_ID);
    withPads(pad);
    input.setContext('OVERWORLD');
    pad.axes = [0.575, 0, 0, 0];
    key('KeyD');
    poll();
    expect(input.axis('MOVE_X')).toBe(1);
    key('KeyD', 'keyUp');
    key('KeyA');
    poll();
    expect(input.axis('MOVE_X')).toBeCloseTo(-0.5, 12);
    setButton(pad, PAD.DPAD_RIGHT, true);
    poll();
    expect(input.axis('MOVE_X')).toBeCloseTo(0.5, 12);
  });

  it('mapeamento padrão equivalente em Xbox e PS5 (REQ-INP-003)', () => {
    const cases: Array<
      [Parameters<InputManager['setContext']>[0], Parameters<InputManager['down']>[0], number]
    > = [
      ['OVERWORLD', 'INTERACT', PAD.A],
      ['FLIGHT', 'FIRE', PAD.X],
      ['FLIGHT', 'TOGGLE_SENSOR', PAD.Y],
      ['FLIGHT', 'RTH', PAD.B],
      ['FLIGHT', 'PAUSE', PAD.MENU],
      ['OVERWORLD', 'TOGGLE_DIMENSION', PAD.Y],
      ['OVERWORLD', 'CYCLE_VEHICLE', PAD.LB],
      ['FLIGHT', 'TIME_WARP', PAD.RB],
      ['UI', 'UI_CONFIRM', PAD.A],
      ['UI', 'UI_BACK', PAD.B],
      ['UI', 'UI_TAB_PREV', PAD.LB],
      ['UI', 'UI_TAB_NEXT', PAD.RB],
      ['UI', 'UI_UP', PAD.DPAD_UP],
      ['UI', 'UI_DOWN', PAD.DPAD_DOWN],
      ['UI', 'UI_LEFT', PAD.DPAD_LEFT],
      ['UI', 'UI_RIGHT', PAD.DPAD_RIGHT],
      ['HOLO', 'FIRE', PAD.X],
    ];
    for (const id of [XBOX_ID, DUALSENSE_ID]) {
      const pad = createPad(id);
      withPads(pad);
      for (const [ctx, action, button] of cases) {
        input.setContext(ctx);
        setButton(pad, button, true);
        poll();
        expect(input.down(action), `${id} ${ctx} ${action}`).toBe(true);
        setButton(pad, button, false);
        poll();
        expect(input.down(action)).toBe(false);
      }
      uninstall();
    }
  });

  it('analógico direito orbita na mesa e os gatilhos dão zoom', () => {
    const pad = createPad(DUALSENSE_ID);
    withPads(pad);
    input.setContext('HOLO');
    pad.axes = [0, 0, -1, 0];
    setButton(pad, PAD.LT, 1);
    poll();
    expect(input.axis('LOOK_X')).toBe(-1);
    expect(input.axis('ZOOM')).toBe(-1);
    pad.axes = [0, 0, 0, -1];
    poll();
    expect(input.axis('LOOK_X')).toBe(0);
    expect(input.axis('LOOK_Y')).toBe(1);
  });

  it('vários controles: botões em OR e o analógico de maior inclinação', () => {
    const a = createPad(XBOX_ID, 0);
    const b = createPad(DUALSENSE_ID, 1);
    withPads(a, b);
    input.setContext('OVERWORLD');
    a.axes = [0.3, 0, 0, 0];
    b.axes = [-0.9, 0, 0, 0];
    setButton(a, PAD.A, true);
    poll();
    expect(input.down('INTERACT')).toBe(true);
    expect(input.axis('MOVE_X')).toBeLessThan(-0.8);
    expect(input.gamepads).toHaveLength(2);
  });
});

describe('dispositivo ativo (REQ-INP-004)', () => {
  it('troca para o último dispositivo com input significativo', () => {
    const devices: string[] = [];
    const off = input.subscribe((d) => devices.push(d));
    const xbox = createPad(XBOX_ID, 0);
    const ps = createPad(DUALSENSE_ID, 1);
    withPads(xbox, ps);
    expect(input.activeDevice).toBe('KEYBOARD');

    // Inclinação pequena não conta.
    xbox.axes = [0.3, 0, 0, 0];
    poll();
    expect(input.activeDevice).toBe('KEYBOARD');

    setButton(xbox, PAD.A, true);
    poll();
    expect(input.activeDevice).toBe('XBOX');

    ps.axes = [0, 0.8, 0, 0];
    poll();
    expect(input.activeDevice).toBe('PLAYSTATION');
    ps.axes = [0, 0, 0, 0];

    key('KeyZ');
    expect(input.activeDevice).toBe('KEYBOARD');

    setButton(xbox, PAD.A, false);
    poll();
    setButton(xbox, PAD.B, true);
    poll();
    expect(input.activeDevice).toBe('XBOX');

    // Mouse: só a partir de 4 px de deslocamento.
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 102, clientY: 101 });
    expect(input.activeDevice).toBe('XBOX');
    fireEvent.mouseMove(window, { clientX: 104, clientY: 101 });
    expect(input.activeDevice).toBe('KEYBOARD');

    fireEvent.mouseDown(window, { buttons: 1 });
    off();
    expect(devices).toEqual(['XBOX', 'PLAYSTATION', 'KEYBOARD', 'XBOX', 'KEYBOARD']);
  });
});

describe('mouse', () => {
  it('acumula deslocamento e roda até o poll', () => {
    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 15, clientY: 7 });
    fireEvent.mouseMove(window, { clientX: 20, clientY: 9 });
    fireEvent.wheel(window, { deltaY: 120 });
    fireEvent.mouseDown(window, { buttons: 1 });
    poll();
    expect(input.mouse).toEqual({ x: 20, y: 9, dx: 10, dy: -1, wheel: 1, buttons: 1 });
    poll();
    expect(input.mouse).toMatchObject({ dx: 0, dy: 0, wheel: 0 });
    fireEvent.mouseUp(window, { buttons: 0 });
    fireEvent.wheel(window, { deltaY: -3 });
    poll();
    expect(input.mouse).toMatchObject({ buttons: 0, wheel: -1 });
  });
});

describe('contextos e camadas', () => {
  it('o contexto UI bloqueia as ações de jogo (input §6, caso 6)', () => {
    input.setContext('FLIGHT');
    key('KeyD');
    key('Space');
    poll();
    expect(input.axis('MOVE_X')).toBe(1);
    expect(input.down('FIRE')).toBe(true);

    const release = input.pushLayer({ context: 'UI', modal: true });
    expect(input.context).toBe('UI');
    expect(input.axis('MOVE_X')).toBe(0);
    expect(input.down('FIRE')).toBe(false);
    expect(input.pressed('FIRE')).toBe(false);

    release();
    expect(input.context).toBe('FLIGHT');
    expect(input.axis('MOVE_X')).toBe(1);
  });

  it('as ações vão para a camada do topo; modais ficam acima mesmo montando antes', () => {
    const got: string[] = [];
    const offModal = input.pushLayer({
      context: 'UI',
      modal: true,
      handler: (e) => {
        got.push(`modal ${e.action}`);
        return true;
      },
    });
    const offPanel = input.pushLayer({
      context: 'UI',
      modal: false,
      handler: (e) => {
        got.push(`painel ${e.action}`);
        return true;
      },
    });
    expect(input.hasModalLayer).toBe(true);
    key('ArrowDown');
    offModal();
    key('ArrowDown');
    offPanel();
    expect(got).toEqual(['modal UI_DOWN', 'painel UI_DOWN']);
  });

  it('Esc volta na camada do topo; se nada voltar, vira PAUSE', () => {
    const globals: ActionEvent[] = [];
    input.onAction((e) => globals.push(e));
    let backs = 0;
    const off = input.pushLayer({
      context: 'UI',
      modal: true,
      handler: (e) => {
        if (e.action !== 'UI_BACK') return false;
        backs++;
        return true;
      },
    });
    key('Escape');
    expect(backs).toBe(1);
    expect(globals.map((e) => e.action)).toEqual([]);
    off();
    key('Escape', 'keyUp');
    key('Escape');
    expect(globals.map((e) => e.action)).toEqual(['UI_BACK', 'PAUSE']);
  });

  it('no voo, Esc e M pausam direto; o B do controle é RTH', () => {
    const globals: string[] = [];
    input.onAction((e) => globals.push(e.action));
    input.setContext('FLIGHT');
    key('Escape');
    key('KeyM');
    const pad = createPad(XBOX_ID);
    withPads(pad);
    setButton(pad, PAD.B, true);
    poll();
    expect(globals).toEqual(['PAUSE', 'PAUSE', 'RTH']);
  });

  it('repetição de teclado só vale para a navegação de UI', () => {
    const got: string[] = [];
    input.pushLayer({
      context: 'UI',
      modal: false,
      handler: (e) => {
        got.push(`${e.action}:${e.repeatCount}`);
        return true;
      },
    });
    key('ArrowDown');
    key('ArrowDown', 'keyDown', { repeat: true });
    key('ArrowDown', 'keyDown', { repeat: true });
    key('Enter');
    key('Enter', 'keyDown', { repeat: true });
    expect(got).toEqual(['UI_DOWN:0', 'UI_DOWN:1', 'UI_DOWN:2', 'UI_CONFIRM:0']);
  });

  it('D-pad e analógico mantidos repetem a cada 180 ms depois de 350 ms', () => {
    const got: ActionEvent[] = [];
    input.pushLayer({
      context: 'UI',
      modal: false,
      handler: (e) => {
        got.push(e);
        return true;
      },
    });
    const pad = createPad(DUALSENSE_ID);
    withPads(pad);
    setButton(pad, PAD.DPAD_DOWN, true);
    input.poll(1000);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ action: 'UI_DOWN', device: 'PLAYSTATION', repeat: false });
    input.poll(1000 + UI_REPEAT_DELAY_MS - 1);
    expect(got).toHaveLength(1);
    input.poll(1000 + UI_REPEAT_DELAY_MS);
    expect(got).toHaveLength(2);
    input.poll(1000 + UI_REPEAT_DELAY_MS + UI_REPEAT_INTERVAL_MS - 1);
    expect(got).toHaveLength(2);
    input.poll(1000 + UI_REPEAT_DELAY_MS + UI_REPEAT_INTERVAL_MS);
    expect(got.map((e) => e.repeatCount)).toEqual([0, 1, 2]);

    setButton(pad, PAD.DPAD_DOWN, false);
    input.poll(3000);
    pad.axes = [0.9, 0, 0, 0];
    input.poll(3016);
    expect(got.at(-1)).toMatchObject({ action: 'UI_RIGHT', repeat: false });
    input.poll(5000);
    expect(got.at(-1)).toMatchObject({ action: 'UI_RIGHT', repeat: true });
  });

  it('poll com o mesmo instante é ignorado (vários loops no mesmo frame)', () => {
    input.setContext('FLIGHT');
    key('Space');
    input.poll(500);
    expect(input.pressed('FIRE')).toBe(true);
    input.poll(500);
    expect(input.pressed('FIRE')).toBe(true);
    input.poll(516);
    expect(input.pressed('FIRE')).toBe(false);
  });
});

describe('conexão de controles (REQ-INP-002)', () => {
  it('avisa conexão, mapeamento e desconexão', () => {
    const events: string[] = [];
    input.onConnection((c) => events.push(`${c.connected ? '+' : '-'}${c.family}:${c.standard}`));
    const pad = createPad('Generic USB Joystick', 2, '');
    const connect = Object.assign(new Event('gamepadconnected'), { gamepad: pad });
    window.dispatchEvent(connect);
    expect(input.gamepads.map((g) => g.family)).toEqual(['GENERIC']);
    // O mesmo controle visto no poll não gera outro aviso.
    withPads(pad);
    poll();
    window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: pad }));
    expect(input.gamepads).toHaveLength(0);
    window.dispatchEvent(new Event('gamepaddisconnected'));
    expect(events).toEqual(['+GENERIC:false', '-GENERIC:false']);
  });

  it('um controle já ligado antes da página aparece no primeiro poll', () => {
    const events: string[] = [];
    input.onConnection((c) => events.push(c.family));
    withPads(createPad(DUALSENSE_ID));
    poll();
    expect(events).toEqual(['PLAYSTATION']);
  });

  it('detach remove os ouvintes', () => {
    input.setContext('FLIGHT');
    input.detach();
    key('Space');
    poll();
    expect(input.down('FIRE')).toBe(false);
    input.attach(window);
    input.attach(window);
    key('Space');
    poll();
    expect(input.down('FIRE')).toBe(true);
  });
});

describe('tabela de bindings', () => {
  it('cada contexto tem PAUSE no botão Menu/Options', () => {
    for (const ctx of Object.keys(BINDINGS) as Array<keyof typeof BINDINGS>) {
      expect(BINDINGS[ctx].buttons.PAUSE?.pad, ctx).toContain(PAD.MENU);
    }
  });

  it('as telas com dica do tutorial ligam DISMISS_HINT ao H e ao View do controle', () => {
    for (const ctx of ['OVERWORLD', 'FLIGHT', 'FIELD', 'UI'] as const) {
      expect(BINDINGS[ctx].buttons.DISMISS_HINT, ctx).toEqual({ keys: ['KeyH'], pad: [PAD.VIEW] });
    }
    // O H não é de nenhum outro botão nem eixo desses contextos.
    for (const ctx of ['OVERWORLD', 'FLIGHT', 'FIELD', 'UI'] as const) {
      expect(buttonActionsForKey(ctx, 'KeyH'), ctx).toEqual(['DISMISS_HINT']);
      expect(isAxisKey(ctx, 'KeyH'), ctx).toBe(false);
    }
  });

  it('nenhuma tecla vale duas ações de botão no mesmo contexto', () => {
    for (const ctx of Object.keys(BINDINGS) as Array<keyof typeof BINDINGS>) {
      const seen = new Map<string, string>();
      for (const [action, binding] of Object.entries(BINDINGS[ctx].buttons)) {
        for (const code of binding?.keys ?? []) {
          expect(
            seen.get(code),
            `${ctx}: ${code} em ${seen.get(code)} e ${action}`,
          ).toBeUndefined();
          seen.set(code, action);
        }
      }
    }
  });

  it('HOLO_PANEL (painel de alas aberto): setas, Enter e Esc navegam; W fecha; sem Tab nem órbita por teclado', () => {
    const b = BINDINGS.HOLO_PANEL;
    expect(b.buttons.UI_UP?.keys).toEqual(['ArrowUp']);
    expect(b.buttons.UI_DOWN?.keys).toEqual(['ArrowDown']);
    expect(b.buttons.UI_LEFT?.keys).toEqual(['ArrowLeft']);
    expect(b.buttons.UI_RIGHT?.keys).toEqual(['ArrowRight']);
    expect(b.buttons.UI_CONFIRM?.keys).toContain('Enter');
    expect(b.buttons.UI_BACK?.keys).toContain('Escape');
    expect(b.buttons.UI_TAB_NEXT).toEqual({ keys: ['KeyW'], pad: [PAD.RB] });
    // O Tab fica livre para o foco nativo; as setas navegam, então não orbitam.
    expect(buttonActionsForKey('HOLO_PANEL', 'Tab')).toEqual([]);
    expect(isAxisKey('HOLO_PANEL', 'Tab')).toBe(false);
    expect(isAxisKey('HOLO_PANEL', 'ArrowLeft')).toBe(false);
    // O analógico direito segue orbitando e os gatilhos dão zoom.
    expect(b.axes.LOOK_X?.stick).toEqual({ axis: 2 });
    expect(b.axes.ZOOM?.triggerPos).toBe(PAD.RT);
    // Na mesa, sem o painel, o Tab troca de dimensão e as setas orbitam (o contexto não mudou).
    expect(buttonActionsForKey('HOLO', 'Tab')).toEqual(['TOGGLE_DIMENSION']);
    expect(isAxisKey('HOLO', 'ArrowLeft')).toBe(true);
  });

  it('contexto UI: o analógico direito e o zoom valem (nuvem 3D do relatório); as setas não', () => {
    const pad = createPad(XBOX_ID);
    uninstall = installGamepads([pad]);
    input.setContext('UI');
    pad.axes = [0, 0, 1, 0];
    setButton(pad, PAD.RT, 1);
    poll();
    expect(input.axis('LOOK_X')).toBeCloseTo(1, 5);
    expect(input.axis('ZOOM')).toBeGreaterThan(0.9);
    // Eixo Y do analógico: para cima é negativo no hardware; LOOK_Y é invertido.
    pad.axes = [0, 0, 0, -1];
    poll();
    expect(input.axis('LOOK_Y')).toBeCloseTo(1, 5);
    pad.axes = [0, 0, 1, 0];
    poll();
    key('ArrowRight');
    poll();
    expect(input.axis('LOOK_X')).toBeCloseTo(1, 5);
    key('ArrowRight', 'keyUp');
  });
});
