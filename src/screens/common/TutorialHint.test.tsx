import { act, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { completeTutorialStep, TUTORIAL_STEPS, TutorialHint } from './TutorialHint';

const get = () => useGameStore.getState();

beforeEach(() => resetGameStore());

describe('TutorialHint (tutorial dirigido do C00)', () => {
  it('5 dicas, uma por tela; só a da etapa corrente aparece', () => {
    expect(TUTORIAL_STEPS).toBe(5);
    render(
      <>
        <TutorialHint step={0} />
        <TutorialHint step={1} />
      </>,
    );
    const hint = screen.getByTestId('tutorial-hint');
    expect(hint).toHaveAttribute('data-step', '0');
    expect(hint).toHaveTextContent('Encoste no marcador e aperte');
    expect(hint.querySelector('[data-glyph-action="INTERACT"]')).not.toBeNull();
  });

  it('"Entendi" avança a etapa; cada dica aparece uma vez', () => {
    render(<TutorialHint step={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(get().flags.tutorialStep).toBe(1);
    expect(screen.queryByTestId('tutorial-hint')).not.toBeInTheDocument();
  });

  it('a ação DISMISS_HINT (H no teclado) faz o mesmo que "Entendi", sem mouse nem foco', () => {
    render(<TutorialHint step={0} />);
    // O glyph da tecla aparece ao lado do botão.
    expect(
      screen.getByTestId('tutorial-hint').querySelector('[data-glyph-action="DISMISS_HINT"]'),
    ).not.toBeNull();
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH' });
    expect(get().flags.tutorialStep).toBe(1);
    expect(screen.queryByTestId('tutorial-hint')).not.toBeInTheDocument();
  });

  it('o H só vale com a dica na tela e não dispensa a dica da etapa seguinte de uma vez', () => {
    // Sem dica da etapa corrente montada, o H não avança nada.
    render(<TutorialHint step={2} />);
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH' });
    expect(get().flags.tutorialStep).toBe(0);
  });

  it('com o jogo pausado o H não mexe no tutorial', () => {
    act(() => get().setPaused(true));
    render(<TutorialHint step={0} />);
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH' });
    expect(get().flags.tutorialStep).toBe(0);
  });

  it('completeTutorialStep só avança na etapa exata', () => {
    act(() => completeTutorialStep(2));
    expect(get().flags.tutorialStep).toBe(0);
    act(() => completeTutorialStep(0));
    act(() => completeTutorialStep(0));
    expect(get().flags.tutorialStep).toBe(1);
  });
});
