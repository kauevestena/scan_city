import { act, fireEvent, render, screen } from '@testing-library/react';
import { DialogueBox } from './DialogueBox';

const speaker = {
  name: 'Tia Zefa',
  shape: 'CIRCLE',
  icon: 'Compass',
  primary: 'cyan',
  secondary: 'black',
  initials: 'TZ',
} as const;

describe('DialogueBox', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('escreve a 40 caracteres por segundo', () => {
    render(<DialogueBox speaker={speaker} lines={['0123456789ABCDEFGHIJ']} onDone={vi.fn()} />);
    const text = screen.getByTestId('dialogue-text');
    expect(text).toHaveTextContent('');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(text).toHaveTextContent('0123456789');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(text).toHaveTextContent('0123456789ABCDEFGHIJ');
  });

  it('um clique completa a linha, o seguinte avança e o último chama onDone', () => {
    const onDone = vi.fn();
    render(
      <DialogueBox speaker={speaker} lines={['Primeira linha.', 'Segunda.']} onDone={onDone} />,
    );
    const box = screen.getByRole('button', { name: 'Avançar diálogo' });
    const text = screen.getByTestId('dialogue-text');

    fireEvent.click(box);
    expect(text).toHaveTextContent('Primeira linha.');
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(box);
    expect(text).toHaveTextContent('');
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(text).toHaveTextContent('Se');

    fireEvent.click(box);
    expect(text).toHaveTextContent('Segunda.');
    fireEvent.click(box);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('mostra o nome e o emblema de quem fala', () => {
    render(<DialogueBox speaker={speaker} lines={['Oi']} onDone={vi.fn()} />);
    expect(screen.getByText('Tia Zefa')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tia Zefa' })).toHaveAttribute('data-shape', 'CIRCLE');
  });
});
