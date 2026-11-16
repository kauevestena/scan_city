import { fireEvent, render, screen } from '@testing-library/react';
import { AudioEngine } from '@/audio/AudioEngine';
import { Button } from './Button';
import {
  focusFromNavigation,
  HOVER_MIN_GAP_MS,
  isHoverPointer,
  playHover,
  resetHoverSound,
} from './hoverSound';
import { Tabs } from './Tabs';

let play: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetHoverSound();
  delete document.documentElement.dataset.inputDevice;
  play = vi.spyOn(AudioEngine.get(), 'play').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const hovers = () => (play.mock.calls as unknown[][]).filter(([id]) => id === 'UI_HOVER').length;

describe('playHover (audio §4: UI_HOVER)', () => {
  it('toca no máximo uma vez a cada 70 ms', () => {
    expect(playHover(1000)).toBe(true);
    expect(playHover(1000 + HOVER_MIN_GAP_MS - 1)).toBe(false);
    expect(playHover(1000 + HOVER_MIN_GAP_MS)).toBe(true);
    expect(hovers()).toBe(2);
  });

  it('só o mouse "passa por cima"; o toque não', () => {
    expect(isHoverPointer('mouse')).toBe(true);
    expect(isHoverPointer(undefined)).toBe(true);
    expect(isHoverPointer('touch')).toBe(false);
    expect(isHoverPointer('pen')).toBe(false);
  });

  it('o foco do gamepad conta sempre; o do teclado, só se for :focus-visible', () => {
    const el = document.createElement('button');
    document.body.append(el);
    document.documentElement.dataset.inputDevice = 'GAMEPAD';
    expect(focusFromNavigation(el)).toBe(true);
    document.documentElement.dataset.inputDevice = 'KEYBOARD';
    // Sem foco no elemento, `:focus-visible` não casa (e o jsdom, sem suporte, cai em falso).
    expect(focusFromNavigation(el)).toBe(false);
    el.remove();
  });
});

describe('Button toca o UI_HOVER', () => {
  it('ao passar o mouse, uma vez; passar de novo logo em seguida não repete', () => {
    render(<Button>Ir</Button>);
    const button = screen.getByRole('button', { name: 'Ir' });
    fireEvent.pointerEnter(button);
    expect(hovers()).toBe(1);
    fireEvent.pointerEnter(button);
    expect(hovers()).toBe(1);
  });

  it('o foco por gamepad toca; o clique continua tocando o UI_CLICK e chamando o onClick', () => {
    document.documentElement.dataset.inputDevice = 'GAMEPAD';
    const onClick = vi.fn();
    const onFocus = vi.fn();
    render(
      <Button onClick={onClick} onFocus={onFocus}>
        Ir
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Ir' });
    fireEvent.focus(button);
    expect(hovers()).toBe(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('UI_CLICK');
  });

  it('botão desabilitado ou carregando fica mudo, e os handlers do chamador seguem valendo', () => {
    const onPointerEnter = vi.fn();
    render(
      <Button disabled onPointerEnter={onPointerEnter}>
        Ir
      </Button>,
    );
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Ir' }));
    expect(hovers()).toBe(0);
  });

  it('o handler de pointerenter do chamador também roda', () => {
    const onPointerEnter = vi.fn();
    render(<Button onPointerEnter={onPointerEnter}>Ir</Button>);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Ir' }));
    expect(onPointerEnter).toHaveBeenCalledTimes(1);
    expect(hovers()).toBe(1);
  });
});

describe('Tabs tocam o UI_HOVER', () => {
  const tabs = [
    { id: 'A', label: 'Aba A' },
    { id: 'B', label: 'Aba B', disabled: true },
  ];

  it('ao passar o mouse numa aba habilitada; a desabilitada fica muda', () => {
    render(<Tabs tabs={tabs} value="A" onChange={() => undefined} />);
    fireEvent.pointerEnter(screen.getByRole('tab', { name: 'Aba A' }));
    expect(hovers()).toBe(1);
    resetHoverSound();
    fireEvent.pointerEnter(screen.getByRole('tab', { name: 'Aba B' }));
    expect(hovers()).toBe(1);
  });
});
