import { act, fireEvent, render, screen } from '@testing-library/react';
import { TOAST_DURATION_MS, ToastHost } from './ToastHost';
import { useGameStore } from '@/state/store';
import { initialSession } from '@/state/slices/sessionSlice';

const push = (title: string) =>
  act(() => {
    useGameStore.getState().pushToast({ type: 'info', title });
  });

describe('ToastHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState({ session: initialSession() });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra no máximo 4 toasts; os demais aguardam na fila', () => {
    render(<ToastHost />);
    for (let i = 1; i <= 6; i++) push(`Aviso ${i}`);
    expect(screen.getAllByRole('status')).toHaveLength(4);
    expect(screen.getByText('Aviso 4')).toBeInTheDocument();
    expect(screen.queryByText('Aviso 5')).not.toBeInTheDocument();
  });

  it('cada toast expira 4 s depois de ficar visível', () => {
    render(<ToastHost />);
    for (let i = 1; i <= 5; i++) push(`Aviso ${i}`);

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    });
    expect(screen.getAllByRole('status')).toHaveLength(4);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    // Os 4 primeiros saíram; o 5º entra e começa a contar agora.
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('Aviso 5')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(useGameStore.getState().session.toasts).toHaveLength(0);
  });

  it('pode ser dispensado manualmente e usa a cor do tipo', () => {
    render(<ToastHost />);
    act(() => {
      useGameStore.getState().pushToast({ type: 'error', title: 'Falhou', body: 'Detalhe' });
    });
    const toast = screen.getByRole('alert');
    expect(toast).toHaveAttribute('data-toast-type', 'error');
    expect(toast.className).toContain('border-rose-500');
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar aviso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
