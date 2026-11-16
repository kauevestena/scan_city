import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '@/App';
import { InputManager } from '@/input/InputManager';
import { Button, Modal } from '@/ui';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { resetDebugFlagsCache } from './debugFlags';

const get = () => useGameStore.getState();

function open(url: string) {
  window.history.replaceState(null, '', url);
  resetDebugFlagsCache();
  return render(<App />);
}

beforeEach(() => {
  resetGameStore();
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
  resetDebugFlagsCache();
});

/** Jogo já apresentado: sem a intro por cima do escritório. */
function skipIntro() {
  useGameStore.getState().setFlags({ introSeen: true });
}

describe('App + ScreenRouter', () => {
  it('abre no escritório real, com a barra superior', () => {
    skipIntro();
    open('/');
    expect(screen.getByTestId('office-screen')).toBeInTheDocument();
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('debug-screen-shell')).not.toBeInTheDocument();
  });

  it('as telas são reais; o painel de depuração abre com F9 e continua aberto entre elas', () => {
    open('/?debug=1&screen=WORLD_MAP');
    expect(screen.getByTestId('world-map-screen')).toBeInTheDocument();
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    // Sobre telas reais, o painel de depuração abre com F9 e continua aberto entre elas.
    fireEvent.keyDown(window, { key: 'F9' });
    fireEvent.click(screen.getByRole('button', { name: 'T6 → FIELD_SETUP' }));
    // O planejamento de campo é real: a transição de depuração já cria a missão.
    expect(screen.getByTestId('field-setup-screen')).toBeInTheDocument();
    expect(get().session.payload).toEqual({ contractId: 'C00', rivalAdjustment: 1 });
    expect(get().mission.active).toMatchObject({ contractId: 'C00', status: 'PLANNING' });
    expect(screen.queryByTestId('top-bar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'T8 → SURVEY_FLIGHT' }));
    expect(get().session.screen).toBe('SURVEY_FLIGHT');
    expect(screen.getAllByRole('button', { name: /^T\d+ →/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'T10 → WORLD_MAP' }));
    expect(screen.getByTestId('world-map-screen')).toBeInTheDocument();
    skipIntro();
    fireEvent.click(
      within(screen.getByTestId('debug-overlay')).getByRole('button', { name: 'T5 → OFFICE' }),
    );
    expect(screen.getByTestId('office-screen')).toBeInTheDocument();
  });

  it('as ações rápidas dão dinheiro e geram missão pendente', () => {
    open('/?debug=1&screen=INFOGRAPHIC_LAB');
    fireEvent.keyDown(window, { key: 'F9' });
    fireEvent.click(screen.getByRole('button', { name: /^\+ R\$/ }));
    expect(get().player.money).toBe(1_500_000);
    expect(screen.getByTestId('debug-money').textContent?.replace(/\s/g, ' ')).toBe(
      'Saldo: R$ 15.000,00',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gerar missão pendente' }));
    expect(get().mission.pending).toHaveLength(1);
  });

  it('F9 abre o painel de depuração sobre as telas reais (só com ?debug=1)', () => {
    skipIntro();
    const { unmount } = open('/?debug=1');
    expect(screen.queryByTestId('debug-overlay')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'F9' });
    expect(screen.getByTestId('debug-overlay')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'T3 → INFOGRAPHIC_LAB' }));
    // O laboratório é uma tela real: o painel flutuante segue aberto sobre ela.
    expect(screen.getByTestId('lab-screen')).toBeInTheDocument();
    expect(screen.getByTestId('debug-overlay')).toBeInTheDocument();
    unmount();
    open('/');
    fireEvent.keyDown(window, { key: 'F9' });
    expect(screen.queryByTestId('debug-overlay')).not.toBeInTheDocument();
  });

  it('?debug=1&screen=UIKIT abre a galeria; sem debug, o parâmetro é ignorado', () => {
    const { unmount } = open('/?debug=1&screen=UIKIT');
    expect(screen.getByRole('heading', { name: 'Kit de UI' })).toBeInTheDocument();
    unmount();
    skipIntro();
    open('/?screen=UIKIT');
    expect(screen.queryByRole('heading', { name: 'Kit de UI' })).not.toBeInTheDocument();
    expect(screen.getByTestId('office-screen')).toBeInTheDocument();
  });

  it('?debug=1&screen=X abre a tela pedida', () => {
    open('/?debug=1&screen=INFOGRAPHIC_LAB&money=42');
    expect(screen.getByTestId('lab-screen')).toBeInTheDocument();
    expect(get().player.money).toBe(4200);
  });

  it('os toasts da store aparecem na tela', () => {
    skipIntro();
    open('/');
    act(() => {
      get().pushToast({ type: 'success', title: 'Novo contrato: Sítio do Avô' });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Novo contrato: Sítio do Avô');
  });
});

describe('InputDriver', () => {
  it('avisa conexão de controle, mapeamento não padrão e desconexão', () => {
    open('/');
    const pad = { id: '054c-0ce6-Wireless Controller', index: 0, mapping: '' };
    act(() => {
      window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
    });
    expect(get().session.toasts.map((t) => t.title)).toEqual([
      'Controle conectado: PlayStation',
      'Controle com mapeamento não padrão — botões podem variar',
    ]);
    act(() => {
      window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: pad }));
    });
    expect(get().session.toasts.at(-1)?.title).toBe('Controle desconectado: PlayStation');
  });

  it('marca o dispositivo ativo na raiz, para o anel de foco do gamepad', () => {
    open('/');
    expect(document.documentElement.dataset.inputDevice).toBe('KEYBOARD');
    const pad = {
      id: 'Xbox Wireless Controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0, value: i === 0 ? 1 : 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    act(() => InputManager.get().poll(5));
    expect(document.documentElement.dataset.inputDevice).toBe('GAMEPAD');
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
  });
});

describe('PauseOverlay', () => {
  beforeEach(() => skipIntro());

  it('Esc abre a pausa e congela session.paused; Continuar retoma', () => {
    open('/');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(get().session.paused).toBe(true);
    const dialog = screen.getByRole('dialog', { name: 'Jogo pausado' });
    expect(within(dialog).getByTestId('app-version')).toHaveTextContent(/Scan City · Versão \d/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(get().session.paused).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc dentro do overlay fecha a pausa (sem reabrir)', () => {
    open('/');
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(get().session.paused).toBe(false);
  });

  it('M alterna a pausa; teclas repetidas e campos de texto são ignorados', () => {
    open('/');
    fireEvent.keyDown(window, { key: 'm' });
    expect(get().session.paused).toBe(true);
    fireEvent.keyDown(window, { key: 'M' });
    expect(get().session.paused).toBe(false);
    fireEvent.keyDown(window, { key: 'Escape', repeat: true });
    fireEvent.keyDown(window, { key: 'x' });
    expect(get().session.paused).toBe(false);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'm' });
    expect(get().session.paused).toBe(false);
    input.remove();
  });

  it('não abre a pausa por cima de outro modal; Esc fecha o modal em vez de pausar', () => {
    open('/');
    const other = render(
      <Modal open title="Briefing" onClose={() => other.unmount()}>
        <Button>Aceitar</Button>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'm' });
    expect(get().session.paused).toBe(false);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Briefing' })).not.toBeInTheDocument();
    expect(get().session.paused).toBe(false);
    // Sem modal, o mesmo Esc pausa.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(get().session.paused).toBe(true);
  });

  it('o botão Menu/Options do controle alterna a pausa', () => {
    open('/');
    const pad = {
      id: 'Xbox Wireless Controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    const press = (t: number, down: boolean) => {
      pad.buttons[9] = { pressed: down, value: down ? 1 : 0 };
      act(() => InputManager.get().poll(t));
    };
    press(1, true);
    expect(get().session.paused).toBe(true);
    press(2, false);
    press(3, true);
    expect(get().session.paused).toBe(false);
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
  });
});
