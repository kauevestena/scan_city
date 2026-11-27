import { act, fireEvent, render, screen } from '@testing-library/react';
import { AudioEngine } from '@/audio/AudioEngine';
import { FINALE_LETTER } from '@/data/office';
import { SOUVENIRS } from '@/data/souvenirs';
import { PAD } from '@/input/gamepad';
import { InputManager } from '@/input/InputManager';
import { createPad, installGamepads, setButton, XBOX_ID } from '@/test/fakeGamepad';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import type { Souvenir } from '@/types';
import { SouvenirViewer } from './SouvenirViewer';

const byId = (id: string) => SOUVENIRS.find((s) => s.id === id) as Souvenir;
const notebook = byId('SV_NOTEBOOK');

let nowMs = 0;
beforeEach(() => {
  resetGameStore();
  nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
});

const press = (code: string) => fireEvent.keyDown(window, { code });
/** Um segundo depois: qualquer virada já terminou. */
const later = () => {
  nowMs += 1000;
};
const label = () => screen.getByTestId('souvenir-view-label').textContent ?? '';
const spoken = () => screen.getByTestId('souvenir-face-text').textContent ?? '';
const button = (name: string) => screen.getByRole('button', { name });

describe('SouvenirViewer (office §5.1, REQ-OFF-008)', () => {
  it('abre a caderneta fechada, com a origem, a história e o foco em Próxima', () => {
    render(<SouvenirViewer souvenir={notebook} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Caderneta de Campo do Avô' })).toBeInTheDocument();
    expect(screen.getByText('Presente de Seu Zé Bento · Sítio do Avô')).toBeInTheDocument();
    expect(screen.getByText(notebook.story)).toBeInTheDocument();
    expect(label()).toContain('1 / 8');
    expect(label()).toContain('Capa');
    expect(button('Próxima')).toHaveFocus();
    expect(button('Anterior')).toBeDisabled();
    expect(screen.getByRole('img', { name: 'Desenho: Capa' })).toBeInTheDocument();
  });

  it('folheia por setas, Q/E, botões e as metades do desenho, até a contracapa e de volta', () => {
    render(<SouvenirViewer souvenir={notebook} onClose={() => undefined} />);
    press('ArrowRight');
    later();
    expect(label()).toContain('2 / 8');
    expect(label()).toContain('Por dentro da capa · Regras do agrimensor');
    press('KeyE');
    later();
    expect(label()).toContain('3 / 8');
    fireEvent.click(button('Próxima'));
    later();
    expect(label()).toContain('4 / 8');
    const canvas = screen.getByTestId('souvenir-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 600,
    } as DOMRect);
    fireEvent.click(canvas, { clientX: 800 });
    later();
    expect(label()).toContain('5 / 8');
    fireEvent.click(canvas, { clientX: 120 });
    later();
    expect(label()).toContain('4 / 8');
    press('KeyQ');
    later();
    press('ArrowLeft');
    later();
    expect(label()).toContain('2 / 8');
    for (let i = 0; i < 6; i++) {
      press('ArrowRight');
      later();
    }
    expect(label()).toContain('8 / 8');
    expect(label()).toContain('Contracapa');
    expect(button('Próxima')).toBeDisabled();
    // O foco estava em Próxima, que desabilitou: passa para Anterior.
    expect(button('Anterior')).toHaveFocus();
    press('ArrowRight');
    later();
    expect(label()).toContain('8 / 8');
  });

  it('durante uma virada, guarda um pedido e descarta os outros', () => {
    render(<SouvenirViewer souvenir={notebook} onClose={() => undefined} />);
    press('ArrowRight');
    press('ArrowRight');
    press('ArrowRight');
    expect(label()).toContain('3 / 8');
  });

  it('no controle: RB e o D-pad viram, LB volta, A avança fora dos botões e B fecha', () => {
    const onClose = vi.fn();
    const pad = createPad(XBOX_ID);
    const uninstall = installGamepads([pad]);
    let t = 0;
    const tap = (button: number) => {
      setButton(pad, button, true);
      act(() => InputManager.get().poll((t += 50)));
      setButton(pad, button, false);
      act(() => InputManager.get().poll((t += 50)));
      later();
    };
    try {
      render(<SouvenirViewer souvenir={notebook} onClose={onClose} />);
      tap(PAD.RB);
      expect(label()).toContain('2 / 8');
      tap(PAD.DPAD_RIGHT);
      expect(label()).toContain('3 / 8');
      tap(PAD.LB);
      expect(label()).toContain('2 / 8');
      // Com o foco no próprio diálogo (fora dos botões), o A vira a página.
      act(() => screen.getByTestId('souvenir-viewer').focus());
      tap(PAD.A);
      expect(label()).toContain('3 / 8');
      // No botão focado, o A clica nele.
      act(() => button('Anterior').focus());
      tap(PAD.A);
      expect(label()).toContain('2 / 8');
      tap(PAD.B);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      uninstall();
    }
  });

  it('cada virada toca o papel; Esc fecha', () => {
    const onClose = vi.fn();
    const play = vi.spyOn(AudioEngine.get(), 'play');
    render(<SouvenirViewer souvenir={notebook} onClose={onClose} />);
    press('ArrowRight');
    expect(play).toHaveBeenCalledWith('PAGE_TURN');
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('o leitor de tela lê a vista; a carta do Vô só aparece depois do final', () => {
    const toLastSpread = () => {
      for (let i = 0; i < 6; i++) {
        press('ArrowRight');
        later();
      }
    };
    const first = render(<SouvenirViewer souvenir={notebook} onClose={() => undefined} />);
    toLastSpread();
    expect(label()).toContain('Amanhã · O bolso');
    expect(spoken()).toContain('Bolso dos papéis importantes');
    expect(spoken()).not.toContain(FINALE_LETTER);
    first.unmount();
    act(() => useGameStore.getState().setFlags({ finaleSeen: true }));
    render(<SouvenirViewer souvenir={notebook} onClose={() => undefined} />);
    toLastSpread();
    expect(label()).toContain('Amanhã · A carta do Vô');
    expect(spoken()).toContain(FINALE_LETTER);
  });

  it('um objeto: a chave, a placa do estojo e o certificado', () => {
    render(<SouvenirViewer souvenir={byId('SV_CITY_KEY')} onClose={() => undefined} />);
    expect(label()).toContain('1 / 3');
    expect(label()).toContain('A chave');
    expect(
      screen.getByText('Presente de Prefeito Dr. Aurélio Bastos · Metrópole Vertical'),
    ).toBeInTheDocument();
    press('ArrowRight');
    later();
    expect(label()).toContain('Placa do estojo');
    expect(spoken()).toContain('CHAVE DA CIDADE');
    press('ArrowRight');
    later();
    expect(spoken()).toContain('Obs.: o IPTU continua devido.');
  });
});
