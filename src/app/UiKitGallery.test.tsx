import { fireEvent, render, screen } from '@testing-library/react';
import { initialSession } from '@/state/slices/sessionSlice';
import { useGameStore } from '@/state/store';
import { UiKitGallery } from './UiKitGallery';

const KIT = [
  'Panel',
  'Button',
  'Slider',
  'Tabs',
  'Modal',
  'ConfirmDialog',
  'Toast',
  'ToastHost',
  'Stat',
  'Gauge',
  'ProgressBar',
  'ChecklistItem',
  'Tooltip',
  'InputGlyph',
  'EmblemBadge',
  'MoneyText',
  'DialogueBox',
];

describe('UiKitGallery', () => {
  it('renderiza os 17 componentes do kit', () => {
    const { container } = render(<UiKitGallery />);
    const sections = Array.from(container.querySelectorAll('[data-kit-component]')).map((el) =>
      el.getAttribute('data-kit-component'),
    );
    expect(sections).toEqual(KIT);
    for (const el of container.querySelectorAll('[data-kit-component]')) {
      expect(el.children.length, el.getAttribute('data-kit-component') ?? '').toBeGreaterThan(0);
    }
  });

  it('os controles interativos da galeria funcionam', () => {
    useGameStore.setState({ session: initialSession() });
    render(<UiKitGallery />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir modal' }));
    expect(screen.getByRole('dialog', { name: 'Briefing de exemplo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Novo jogo…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apagar e recomeçar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Disparar money' }));
    expect(useGameStore.getState().session.toasts).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Plano de voo' }));
    expect(screen.getByText('Aba ativa: plan')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'PlayStation' }));
    expect(screen.getByTestId('glyph-grid')).toHaveTextContent('✕');
    fireEvent.click(screen.getByRole('tab', { name: 'Teclado' }));
    expect(screen.getByTestId('glyph-grid')).toHaveTextContent('WASD');

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Altura de voo' }), { key: 'ArrowRight' });
    expect(screen.getByRole('slider', { name: 'Altura de voo' })).toHaveAttribute(
      'aria-valuenow',
      '65',
    );
  });
});
