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

const press = (key: string, code = key) => fireEvent.keyDown(window, { key, code });
/** Telas com para onde voltar tratam o Esc como "voltar"; o M pausa em qualquer uma. */
const pauseKey = () => press('m', 'KeyM');
const menu = () => screen.getByRole('dialog', { name: 'Jogo pausado' });
const button = (name: string | RegExp, within_: HTMLElement = document.body) =>
  within(within_).getByRole('button', { name });

/** Abre o jogo no escritório, com a intro vista, e pausa com o Esc. */
function pause(url = '/?debug=1&skipIntro=1') {
  open(url);
  press('Escape');
  return menu();
}

beforeEach(() => {
  resetGameStore();
});
afterEach(() => {
  window.history.replaceState(null, '', '/');
  resetDebugFlagsCache();
  vi.restoreAllMocks();
});

describe('menu de pausa (REQ-CORE-003)', () => {
  it('Esc abre o menu com Continuar, Configurações, Controles, Salvar agora e Novo jogo', () => {
    const dialog = pause();
    expect(get().session.paused).toBe(true);
    for (const name of ['Continuar', 'Configurações', 'Controles', 'Salvar agora', 'Novo jogo']) {
      expect(button(name, dialog)).toBeInTheDocument();
    }
    // No escritório não há missão para abandonar nem para onde "sair".
    expect(within(dialog).queryByRole('button', { name: 'Abandonar missão' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Sair para o escritório' })).toBeNull();
    expect(within(dialog).getByTestId('app-version')).toBeInTheDocument();
  });

  it('Continuar, Esc e M retomam', () => {
    pause();
    fireEvent.click(button('Continuar'));
    expect(get().session.paused).toBe(false);
    press('Escape');
    expect(get().session.paused).toBe(true);
    press('Escape');
    expect(get().session.paused).toBe(false);
    press('m', 'KeyM');
    expect(get().session.paused).toBe(true);
    press('m', 'KeyM');
    expect(get().session.paused).toBe(false);
  });

  it('o foco abre no primeiro botão do menu', () => {
    const dialog = pause();
    expect(button('Continuar', dialog)).toHaveFocus();
  });
});

describe('Sair para o escritório', () => {
  it('aparece onde a tabela de transições leva ao OFFICE (mapa, mesa, laboratório)', () => {
    for (const screenName of ['WORLD_MAP', 'HOLO_TABLE_VIEW', 'INFOGRAPHIC_LAB']) {
      resetGameStore();
      const { unmount } = open(`/?debug=1&skipIntro=1&screen=${screenName}`);
      pauseKey();
      fireEvent.click(button('Sair para o escritório'));
      expect(get().session.screen).toBe('OFFICE');
      expect(get().session.paused).toBe(false);
      unmount();
    }
  });

  it('não aparece no planejamento nem no voo (sem transição direta ao escritório)', () => {
    for (const screenName of ['FIELD_SETUP', 'SURVEY_FLIGHT']) {
      resetGameStore();
      const { unmount } = open(`/?debug=1&skipIntro=1&screen=${screenName}`);
      pauseKey();
      expect(menu()).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sair para o escritório' })).toBeNull();
      unmount();
    }
  });
});

describe('Abandonar missão (T7 e T10)', () => {
  it('no planejamento: confirma, descarta a missão e vai ao mapa; cancelar mantém tudo', () => {
    open('/?debug=1&skipIntro=1&screen=FIELD_SETUP');
    expect(get().mission.active).not.toBeNull();
    pauseKey();
    fireEvent.click(button('Abandonar missão'));
    const confirm = screen.getByRole('dialog', { name: 'Abandonar o planejamento?' });
    expect(confirm).toHaveTextContent('Os pontos e o plano desta missão serão descartados.');
    fireEvent.click(button('Cancelar', confirm));
    expect(get().session.screen).toBe('FIELD_SETUP');
    expect(get().mission.active).not.toBeNull();
    expect(menu()).toBeInTheDocument();
    fireEvent.click(button('Abandonar missão'));
    fireEvent.click(
      button('Abandonar', screen.getByRole('dialog', { name: 'Abandonar o planejamento?' })),
    );
    expect(get().session.screen).toBe('WORLD_MAP');
    expect(get().session.paused).toBe(false);
    expect(get().mission.active).toBeNull();
  });

  it('no voo: descarta a missão e volta ao mapa com o desfecho ABORTED', () => {
    open('/?debug=1&skipIntro=1&screen=SURVEY_FLIGHT');
    expect(get().mission.active).not.toBeNull();
    pauseKey();
    fireEvent.click(button('Abandonar missão'));
    const confirm = screen.getByRole('dialog', { name: 'Abandonar a missão?' });
    expect(confirm).toHaveTextContent('Todos os dados desta missão serão descartados.');
    fireEvent.click(button('Abandonar', confirm));
    expect(get().session.screen).toBe('WORLD_MAP');
    expect(get().session.paused).toBe(false);
    expect(get().mission.active).toBeNull();
  });

  it('o Esc fecha só a confirmação; o menu continua aberto', () => {
    open('/?debug=1&skipIntro=1&screen=FIELD_SETUP');
    pauseKey();
    fireEvent.click(button('Abandonar missão'));
    expect(screen.getByRole('dialog', { name: 'Abandonar o planejamento?' })).toBeInTheDocument();
    press('Escape');
    expect(screen.queryByRole('dialog', { name: 'Abandonar o planejamento?' })).toBeNull();
    expect(menu()).toBeInTheDocument();
    expect(get().session.paused).toBe(true);
  });
});

describe('Configurações (REQ-AUD-003, REQ-NFR-007)', () => {
  const settingsPanel = () => screen.getByTestId('settings-panel');
  const stored = () =>
    JSON.parse(localStorage.getItem('scan-city-settings') ?? '{}') as Record<string, unknown>;

  it('volume geral e de efeitos mudam na hora e são gravados à parte do save', () => {
    pause();
    fireEvent.click(button('Configurações'));
    const master = within(settingsPanel()).getByRole('slider', { name: 'Volume geral' });
    expect(master).toHaveAttribute('aria-valuenow', '80');
    fireEvent.keyDown(master, { key: 'ArrowRight' });
    expect(get().settings.masterVolume).toBeCloseTo(0.85, 9);
    expect(stored().masterVolume).toBeCloseTo(0.85, 9);
    const sfx = within(settingsPanel()).getByRole('slider', { name: 'Volume dos efeitos' });
    fireEvent.keyDown(sfx, { key: 'Home' });
    expect(get().settings.sfxVolume).toBe(0);
    fireEvent.keyDown(sfx, { key: 'End' });
    expect(get().settings.sfxVolume).toBe(1);
    expect(stored().sfxVolume).toBe(1);
  });

  it('mudo, reduzir flashes e FPS são interruptores acessíveis', () => {
    // Sem `?debug=1` o overlay de FPS só aparece pela configuração.
    get().setFlags({ introSeen: true });
    open('/');
    press('Escape');
    fireEvent.click(button('Configurações'));
    const muted = screen.getByTestId('setting-muted');
    expect(muted).toHaveAttribute('role', 'switch');
    expect(muted).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(muted);
    expect(get().settings.muted).toBe(true);
    expect(screen.getByTestId('setting-muted')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('setting-reduce-flashes'));
    expect(get().settings.reduceFlashes).toBe(true);
    expect(stored().reduceFlashes).toBe(true);
    expect(screen.queryByTestId('fps-overlay')).toBeNull();
    fireEvent.click(screen.getByTestId('setting-show-fps'));
    expect(get().settings.showFps).toBe(true);
    expect(screen.getByTestId('fps-overlay')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('setting-show-fps'));
    expect(screen.queryByTestId('fps-overlay')).toBeNull();
  });

  it('a qualidade gráfica é Baixa, Média ou Alta', () => {
    pause();
    fireEvent.click(button('Configurações'));
    expect(screen.getByTestId('setting-quality-HIGH')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('setting-quality-LOW'));
    expect(get().settings.quality).toBe('LOW');
    expect(screen.getByTestId('setting-quality-LOW')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('setting-quality-HIGH')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByTestId('setting-quality-MEDIUM'));
    expect(stored().quality).toBe('MEDIUM');
  });

  it('o Esc volta ao menu (não retoma) e o botão Voltar também', () => {
    pause();
    fireEvent.click(button('Configurações'));
    expect(screen.getByRole('dialog', { name: 'Configurações' })).toBeInTheDocument();
    press('Escape');
    expect(menu()).toBeInTheDocument();
    expect(get().session.paused).toBe(true);
    fireEvent.click(button('Controles'));
    expect(screen.getByRole('dialog', { name: 'Controles' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pause-back'));
    expect(menu()).toBeInTheDocument();
    press('Escape');
    expect(get().session.paused).toBe(false);
  });
});

describe('Controles (REQ-INP-004)', () => {
  it('lista as ações com o glyph do dispositivo ativo (teclado)', () => {
    pause();
    fireEvent.click(button('Controles'));
    const panel = screen.getByTestId('controls-panel');
    expect(screen.getByTestId('controls-device')).toHaveTextContent('Dispositivo ativo: Teclado');
    for (const label of ['Mover', 'Interagir', 'Pausar', 'Confirmar', 'Acelerar o tempo']) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    // O glyph do teclado para pausar é a tecla Esc.
    const pauseRow = within(panel).getByText('Pausar').closest('li') as HTMLElement;
    expect(pauseRow).toHaveTextContent('Esc');
    const moveRow = within(panel).getByText('Mover').closest('li') as HTMLElement;
    expect(moveRow).toHaveTextContent('WASD');
  });
});

describe('Salvar agora', () => {
  it('grava o que estiver pendente e avisa', () => {
    pause();
    act(() => {
      useGameStore.setState((s) => ({ player: { ...s.player, money: 123_400 } }));
    });
    fireEvent.click(screen.getByTestId('pause-save'));
    expect(localStorage.getItem('scan-city-save')).toContain('"money":123400');
    expect(get().session.toasts.map((t) => t.title)).toContain('Jogo salvo');
  });
});

describe('Novo jogo (REQ-CORE-009)', () => {
  it('pede confirmação in-app (sem window.confirm); cancelar não apaga nada', () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    pause('/?debug=1&skipIntro=1&money=12345');
    fireEvent.click(screen.getByTestId('pause-new-game'));
    const dialog = screen.getByRole('dialog', { name: 'Começar um novo jogo?' });
    expect(dialog).toHaveTextContent('Todo o progresso será perdido. Um backup será guardado.');
    fireEvent.click(button('Cancelar', dialog));
    expect(screen.queryByRole('dialog', { name: 'Começar um novo jogo?' })).toBeNull();
    expect(get().player.money).toBe(1_234_500);
    expect(get().session.paused).toBe(true);
    expect(nativeConfirm).not.toHaveBeenCalled();
  });

  it('confirmar guarda o backup, recomeça no escritório com a intro e mantém as configurações', () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    pause('/?debug=1&skipIntro=1&money=12345');
    // Uma configuração alterada antes do novo jogo.
    fireEvent.click(button('Configurações'));
    fireEvent.click(screen.getByTestId('setting-quality-LOW'));
    fireEvent.click(screen.getByTestId('pause-back'));
    fireEvent.click(screen.getByTestId('pause-new-game'));
    fireEvent.click(
      button('Apagar e recomeçar', screen.getByRole('dialog', { name: 'Começar um novo jogo?' })),
    );

    expect(get().player.money).toBe(500_000);
    expect(get().session.screen).toBe('OFFICE');
    expect(get().session.paused).toBe(false);
    expect(get().flags.introSeen).toBe(false);
    // O save anterior vai para o backup; as configurações sobrevivem.
    expect(localStorage.getItem('scan-city-save-backup')).toContain('"money":1234500');
    expect(get().settings.quality).toBe('LOW');
    expect(screen.queryByRole('dialog', { name: 'Jogo pausado' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Uma carta na mesa' })).toBeInTheDocument();
    expect(nativeConfirm).not.toHaveBeenCalled();
  });
});
