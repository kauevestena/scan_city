import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { createPad, installGamepads, setButton, XBOX_ID } from '@/test/fakeGamepad';
import { Button, Slider } from '@/ui';
import { PAD } from './gamepad';
import { InputManager } from './InputManager';
import { useFocusNavigation, type FocusNavigationOptions } from './useFocusNavigation';

/** Coloca os elementos numa grade 2 × 2 (jsdom não faz layout). */
function placeGrid() {
  const positions: Record<string, [number, number]> = {
    a: [0, 0],
    b: [200, 0],
    c: [0, 100],
    d: [200, 100],
  };
  for (const [id, [left, top]] of Object.entries(positions)) {
    const el = document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`);
    if (el) el.getBoundingClientRect = () => ({ left, top, width: 80, height: 32 }) as DOMRect;
  }
}

function Grid(props: FocusNavigationOptions & { onClick?: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { onClick, ...options } = props;
  useFocusNavigation(ref, options);
  return (
    <div ref={ref}>
      {['a', 'b', 'c', 'd'].map((id) => (
        <Button key={id} data-focus-id={id} onClick={() => onClick?.(id)}>
          {id.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

const btn = (name: string) => screen.getByRole('button', { name });
const key = (code: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement ?? window, { code, ...init });

let uninstall: () => void = () => undefined;
afterEach(() => uninstall());

describe('useFocusNavigation', () => {
  it('setas movem o foco pelo vizinho espacial; sem foco, focam o inicial', () => {
    render(<Grid initialFocus="b" />);
    placeGrid();
    key('ArrowDown');
    expect(btn('B')).toHaveFocus();
    key('ArrowDown');
    expect(btn('D')).toHaveFocus();
    key('ArrowLeft');
    expect(btn('C')).toHaveFocus();
    key('ArrowUp');
    expect(btn('A')).toHaveFocus();
    key('ArrowUp');
    expect(btn('A')).toHaveFocus();
  });

  it('com wrap, a borda volta pelo outro lado', () => {
    render(<Grid wrap />);
    placeGrid();
    btn('B').focus();
    key('ArrowRight');
    expect(btn('A')).toHaveFocus();
  });

  it('UI_CONFIRM do gamepad clica; o do teclado fica com a ativação nativa', () => {
    const clicks: string[] = [];
    render(<Grid onClick={(id) => clicks.push(id)} />);
    placeGrid();
    btn('C').focus();
    key('Enter');
    expect(clicks).toEqual([]);

    const pad = createPad(XBOX_ID);
    uninstall = installGamepads([pad]);
    setButton(pad, PAD.A, true);
    InputManager.get().poll(1);
    expect(clicks).toEqual(['c']);
  });

  it('UI_CONFIRM sem foco no container foca o elemento inicial', () => {
    render(<Grid initialFocus="d" />);
    key('Enter');
    expect(btn('D')).toHaveFocus();
  });

  it('UI_BACK chama onBack; abas com Q/E chamam onTabPrev/onTabNext', () => {
    const calls: string[] = [];
    render(
      <Grid
        onBack={() => calls.push('back')}
        onTabPrev={() => calls.push('prev')}
        onTabNext={() => calls.push('next')}
      />,
    );
    key('Escape');
    key('Backspace');
    key('KeyQ');
    key('KeyE');
    expect(calls).toEqual(['back', 'back', 'prev', 'next']);
  });

  it('sem os callbacks, as ações seguem para os ouvintes globais', () => {
    const globals: string[] = [];
    InputManager.get().onAction((e) => globals.push(e.action));
    render(<Grid />);
    key('KeyQ');
    key('Escape');
    expect(globals).toEqual(['UI_TAB_PREV', 'UI_BACK', 'PAUSE']);
  });

  it('inativo, não registra camada', () => {
    const globals: string[] = [];
    InputManager.get().onAction((e) => globals.push(e.action));
    render(<Grid active={false} onBack={() => globals.push('back')} />);
    key('Backspace');
    expect(globals).toEqual(['UI_BACK']);
  });

  it('↑/↓ saem do slider; ←/→ do gamepad ajustam o valor, acelerando ao manter', () => {
    function WithSlider() {
      const ref = useRef<HTMLDivElement>(null);
      const [value, setValue] = useState(50);
      useFocusNavigation(ref);
      return (
        <div ref={ref}>
          <Button data-focus-id="a">Antes</Button>
          <Slider label="Altura" value={value} min={0} max={200} onChange={setValue} />
        </div>
      );
    }
    render(<WithSlider />);
    const slider = screen.getByRole('slider');
    slider.getBoundingClientRect = () => ({ left: 0, top: 100, width: 200, height: 32 }) as DOMRect;
    btn('Antes').getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 80, height: 32 }) as DOMRect;

    slider.focus();
    fireEvent.keyDown(slider, { code: 'ArrowUp', key: 'ArrowUp' });
    expect(btn('Antes')).toHaveFocus();

    slider.focus();
    const pad = createPad(XBOX_ID);
    uninstall = installGamepads([pad]);
    const input = InputManager.get();
    const poll = (t: number) => act(() => input.poll(t));
    setButton(pad, PAD.DPAD_RIGHT, true);
    poll(1000);
    expect(slider).toHaveAttribute('aria-valuenow', '51');
    // Mantido: as repetições aceleram (1, 1, 2, 2…) até 10 passos por ajuste.
    poll(1350);
    poll(1530);
    poll(1710);
    expect(slider).toHaveAttribute('aria-valuenow', '56');
    for (let t = 1890; t <= 1890 + 180 * 30; t += 180) poll(t);
    expect(slider).toHaveAttribute('aria-valuenow', '200');
    setButton(pad, PAD.DPAD_RIGHT, false);
    poll(9000);
    setButton(pad, PAD.DPAD_LEFT, true);
    poll(9016);
    expect(slider).toHaveAttribute('aria-valuenow', '199');
  });
});

describe('useFocusNavigation — autoFocus (painéis abertos pelo jogador)', () => {
  function Panel({ active = true, initialFocus }: { active?: boolean; initialFocus?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusNavigation(ref, { autoFocus: true, active, ...(initialFocus ? { initialFocus } : {}) });
    return (
      <div ref={ref} data-testid="panel">
        <Button data-focus-id="a">Primeiro</Button>
        <Button data-focus-id="b">Segundo</Button>
      </div>
    );
  }
  function Host({ initialFocus }: { initialFocus?: string }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen((o) => !o)}>Abrir</Button>
        <Button>Outro</Button>
        {open && <Panel {...(initialFocus ? { initialFocus } : {})} />}
      </>
    );
  }

  it('o foco entra no painel ao montar (no primeiro controle ou no initialFocus) e volta ao fechar', () => {
    render(<Host initialFocus="b" />);
    const opener = btn('Abrir');
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(btn('Segundo')).toHaveFocus();
    // Fecha com o foco dentro: ele volta a quem abriu.
    fireEvent.click(opener);
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('sem initialFocus, o primeiro controle ganha o foco', () => {
    render(<Host />);
    btn('Abrir').focus();
    fireEvent.click(btn('Abrir'));
    expect(btn('Primeiro')).toHaveFocus();
  });

  it('quem fecha o painel e já focou outro controle não é atropelado', () => {
    render(<Host />);
    const opener = btn('Abrir');
    opener.focus();
    fireEvent.click(opener);
    expect(btn('Primeiro')).toHaveFocus();
    btn('Outro').focus();
    fireEvent.click(opener);
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
    expect(btn('Outro')).toHaveFocus();
  });

  it('desativar e reativar a camada (uma confirmação que fecha) não rouba o foco de volta', () => {
    const { rerender } = render(<Panel active />);
    expect(btn('Primeiro')).toHaveFocus();
    btn('Segundo').focus();
    rerender(<Panel active={false} />);
    rerender(<Panel active />);
    expect(btn('Segundo')).toHaveFocus();
  });
});
