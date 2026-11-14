import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Slider, snapToStep, type SliderProps } from './Slider';

function Harness(
  props: Partial<SliderProps> & { initial: number; onChangeSpy?: (v: number) => void },
) {
  const { initial, onChangeSpy, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <Slider
      label="Altura"
      min={20}
      max={120}
      step={5}
      unit="m"
      {...rest}
      value={value}
      onChange={(v) => {
        onChangeSpy?.(v);
        setValue(v);
      }}
    />
  );
}

describe('Slider', () => {
  it('← e → alteram o valor em um passo', () => {
    render(<Harness initial={60} />);
    const slider = screen.getByRole('slider', { name: 'Altura' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '65');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '55');
    expect(screen.getByTestId('slider-value')).toHaveTextContent('55 m');
  });

  it('respeita os limites mínimo e máximo', () => {
    const spy = vi.fn();
    render(<Harness initial={115} onChangeSpy={spy} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '120');
    expect(spy).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '20');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '20');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '120');
  });

  it('PageUp/PageDown andam 10 passos e teclas alheias são ignoradas', () => {
    const spy = vi.fn();
    render(<Harness initial={60} onChangeSpy={spy} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(slider).toHaveAttribute('aria-valuenow', '110');
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(slider).toHaveAttribute('aria-valuenow', '60');
    fireEvent.keyDown(slider, { key: 'x' });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('desabilitado não muda', () => {
    const spy = vi.fn();
    render(<Harness initial={60} onChangeSpy={spy} disabled />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.pointerDown(slider, { clientX: 10 });
    expect(spy).not.toHaveBeenCalled();
    expect(slider).toHaveAttribute('tabindex', '-1');
  });

  it('destaca em âmbar dentro da faixa de aviso e usa format', () => {
    render(<Harness initial={40} warnRange={[20, 45]} format={(v) => `H=${v}`} />);
    const value = screen.getByTestId('slider-value');
    expect(value).toHaveTextContent('H=40 m');
    expect(value.className).toContain('text-amber-400');
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(value.className).toContain('text-cyan-300');
  });

  it('arrastar no trilho define o valor pela posição', () => {
    render(<Harness initial={20} marks={[40, 80]} />);
    const slider = screen.getByRole('slider');
    const track = slider.firstElementChild as HTMLElement;
    track.getBoundingClientRect = () =>
      ({
        left: 100,
        width: 200,
        top: 0,
        height: 6,
        right: 300,
        bottom: 6,
        x: 100,
        y: 0,
      }) as DOMRect;
    fireEvent.pointerDown(slider, { clientX: 200, pointerId: 1 });
    expect(slider).toHaveAttribute('aria-valuenow', '70');
    fireEvent.pointerMove(slider, { clientX: 300, pointerId: 1 });
    expect(slider).toHaveAttribute('aria-valuenow', '120');
    fireEvent.pointerUp(slider, { pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 100, pointerId: 1 });
    expect(slider).toHaveAttribute('aria-valuenow', '120');
  });

  it('snapToStep lida com passos decimais sem erro de ponto flutuante', () => {
    expect(snapToStep(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(0.34, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(7, 0, 5, 1)).toBe(5);
    expect(snapToStep(22, 20, 120, 5)).toBe(20);
  });
});
