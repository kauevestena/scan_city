import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '@/App';
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

describe('App + ScreenRouter', () => {
  it('abre no escritório, servido pelo shell enquanto a tela não existe', () => {
    open('/');
    expect(screen.getByTestId('screen-name')).toHaveTextContent('OFFICE');
    expect(screen.getByTestId('screen-payload')).toHaveTextContent('null');
    expect(screen.getAllByRole('button', { name: /^T\d+ →/ })).toHaveLength(4);
  });

  it('navega pelo shell: OFFICE → WORLD_MAP → FIELD_SETUP → SURVEY_FLIGHT', () => {
    open('/');
    fireEvent.click(screen.getByRole('button', { name: 'T1 → WORLD_MAP' }));
    expect(screen.getByTestId('screen-name')).toHaveTextContent('WORLD_MAP');
    fireEvent.click(screen.getByRole('button', { name: 'T6 → FIELD_SETUP' }));
    expect(screen.getByTestId('screen-payload')).toHaveTextContent(
      '{"contractId":"C00","rivalAdjustment":1}',
    );
    fireEvent.click(screen.getByRole('button', { name: 'T8 → SURVEY_FLIGHT' }));
    expect(get().session.screen).toBe('SURVEY_FLIGHT');
    expect(screen.getAllByRole('button', { name: /^T\d+ →/ })).toHaveLength(3);
  });

  it('as ações rápidas dão dinheiro e geram missão pendente', () => {
    open('/');
    fireEvent.click(screen.getByRole('button', { name: /^\+ R\$/ }));
    expect(get().player.money).toBe(1_500_000);
    expect(screen.getByTestId('debug-money').textContent?.replace(/\s/g, ' ')).toBe(
      'Saldo: R$ 15.000,00',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gerar missão pendente' }));
    expect(get().mission.pending).toHaveLength(1);
  });

  it('?debug=1&screen=UIKIT abre a galeria; sem debug, o parâmetro é ignorado', () => {
    const { unmount } = open('/?debug=1&screen=UIKIT');
    expect(screen.getByRole('heading', { name: 'Kit de UI' })).toBeInTheDocument();
    unmount();
    open('/?screen=UIKIT');
    expect(screen.queryByRole('heading', { name: 'Kit de UI' })).not.toBeInTheDocument();
    expect(screen.getByTestId('screen-name')).toHaveTextContent('OFFICE');
  });

  it('?debug=1&screen=X abre a tela pedida', () => {
    open('/?debug=1&screen=HOLO_TABLE_VIEW&money=42');
    expect(screen.getByTestId('screen-name')).toHaveTextContent('HOLO_TABLE_VIEW');
    expect(get().player.money).toBe(4200);
  });

  it('os toasts da store aparecem na tela', () => {
    open('/');
    act(() => {
      get().pushToast({ type: 'success', title: 'Novo contrato: Sítio do Avô' });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Novo contrato: Sítio do Avô');
  });
});

describe('PauseOverlay', () => {
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

  it('não abre a pausa por cima de outro modal', () => {
    open('/');
    const other = document.createElement('div');
    other.setAttribute('role', 'dialog');
    document.body.appendChild(other);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(get().session.paused).toBe(false);
    other.remove();
  });
});
