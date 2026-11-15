import { act, fireEvent, render, screen } from '@testing-library/react';
import { createPad, DUALSENSE_ID, installGamepads, setButton, XBOX_ID } from '@/test/fakeGamepad';
import { PAD } from './gamepad';
import { glyphFor } from './glyphs';
import { InputGlyph } from './InputGlyph';
import { InputManager } from './InputManager';
import { useInputContext } from './useInputContext';

describe('InputGlyph (REQ-INP-004)', () => {
  it('renderiza Espaço, A ou ✕ para INTERACT conforme o dispositivo ativo', () => {
    const xbox = createPad(XBOX_ID, 0);
    const ps = createPad(DUALSENSE_ID, 1);
    const uninstall = installGamepads([xbox, ps]);
    const input = InputManager.get();
    render(<InputGlyph action="INTERACT" label="Interagir" />);
    const glyph = () => screen.getByText((_, el) => el?.tagName === 'KBD');

    expect(glyph()).toHaveTextContent('Espaço');
    expect(glyph()).toHaveAttribute('data-glyph-shape', 'key');
    expect(screen.getByText('Interagir')).toBeInTheDocument();

    setButton(xbox, PAD.A, true);
    act(() => input.poll(1));
    expect(glyph()).toHaveTextContent('A');
    expect(glyph().className).toContain('bg-emerald-400');

    setButton(ps, PAD.X, true);
    act(() => input.poll(2));
    expect(glyph()).toHaveTextContent('✕');
    expect(glyph().className).toContain('bg-sky-400');

    act(() => {
      fireEvent.keyDown(window, { code: 'KeyZ' });
    });
    expect(glyph()).toHaveTextContent('Espaço');
    uninstall();
  });

  it('um dispositivo forçado ignora o ativo', () => {
    render(<InputGlyph action="RTH" device="PLAYSTATION" />);
    expect(screen.getByText('○')).toHaveAttribute('data-glyph-shape', 'face');
  });

  it('a tabela cobre os glyphs de input §4', () => {
    expect(glyphFor('FIRE', 'XBOX')).toMatchObject({ label: 'X', tone: 'blue' });
    expect(glyphFor('FIRE', 'PLAYSTATION')).toMatchObject({ label: '□', tone: 'pink' });
    expect(glyphFor('TOGGLE_SENSOR', 'XBOX')).toMatchObject({ label: 'Y', tone: 'yellow' });
    expect(glyphFor('TOGGLE_SENSOR', 'PLAYSTATION')).toMatchObject({ label: '△', tone: 'green' });
    expect(glyphFor('PAUSE', 'KEYBOARD').label).toBe('Esc');
    expect(glyphFor('PAUSE', 'XBOX').label).toBe('≡ Menu');
    expect(glyphFor('PAUSE', 'PLAYSTATION').label).toBe('Options');
    expect(glyphFor('ALT_UP', 'KEYBOARD').label).toBe('Q');
    expect(glyphFor('ALT_DOWN', 'PLAYSTATION').label).toBe('L2');
    expect(glyphFor('TIME_WARP', 'PLAYSTATION').label).toBe('R1');
    expect(glyphFor('CYCLE_VEHICLE', 'XBOX').label).toBe('LB');
    expect(glyphFor('MOVE', 'KEYBOARD').label).toBe('WASD');
    expect(glyphFor('MOVE', 'PLAYSTATION')).toMatchObject({ label: 'L', shape: 'stick' });
    // Controles genéricos usam os glyphs do Xbox (OQ-003).
    expect(glyphFor('INTERACT', 'GENERIC')).toEqual(glyphFor('INTERACT', 'XBOX'));
  });
});

describe('useInputContext', () => {
  it('define o contexto da tela e restaura o anterior ao desmontar', () => {
    function Screen() {
      useInputContext('FLIGHT');
      return null;
    }
    const input = InputManager.get();
    expect(input.context).toBe('UI');
    const { unmount } = render(<Screen />);
    expect(input.context).toBe('FLIGHT');
    unmount();
    expect(input.context).toBe('UI');
  });
});
