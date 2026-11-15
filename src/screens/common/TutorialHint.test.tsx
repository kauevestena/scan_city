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

  it('completeTutorialStep só avança na etapa exata', () => {
    act(() => completeTutorialStep(2));
    expect(get().flags.tutorialStep).toBe(0);
    act(() => completeTutorialStep(0));
    act(() => completeTutorialStep(0));
    expect(get().flags.tutorialStep).toBe(1);
  });
});
