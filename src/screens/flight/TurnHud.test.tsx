import { act, render, screen } from '@testing-library/react';
import { PAD } from '@/input/gamepad';
import { InputManager } from '@/input/InputManager';
import { createPad, installGamepads, setButton, XBOX_ID } from '@/test/fakeGamepad';
import { snap } from '@/test/hudSnap';
import { FlightHud } from './FlightHud';
import {
  DifficultyChip,
  GoAroundCard,
  TurnMark,
  TurnPrompt,
  turnBarPos,
  VerticalWind,
} from './TurnHud';

const WINDOW = { earlyS: 0.45, lateS: 0.3 };
const turn = (toGateS: number, side: -1 | 1 = 1) => ({
  side,
  toGateS,
  window: WINDOW,
  judged: null,
});

describe('aviso da curva (survey-flight §5.7, ADR-035)', () => {
  it('no teclado: o lado, o acorde W+E+D e a sequência D → E → W; à esquerda, W+A+Q', () => {
    const { rerender } = render(<TurnPrompt snap={snap({ turn: turn(1.5) })} calm={false} />);
    const prompt = screen.getByTestId('hud-turn');
    expect(prompt).toHaveTextContent('CURVA À DIREITA ▶');
    expect(prompt).toHaveAttribute('data-side', '1');
    expect(prompt).toHaveAttribute('data-in-window', 'false');
    const keys = screen.getByTestId('turn-keys');
    expect(keys).toHaveTextContent('W+E+Dsegure juntas· ou toque em sequênciaD→E→W');
    rerender(<TurnPrompt snap={snap({ turn: turn(0.2, -1) })} calm={false} />);
    expect(screen.getByTestId('hud-turn')).toHaveTextContent('◀ CURVA À ESQUERDA');
    expect(screen.getByTestId('hud-turn')).toHaveAttribute('data-in-window', 'true');
    expect(screen.getByTestId('turn-keys')).toHaveTextContent('W+A+Q');
    expect(screen.getByTestId('turn-keys')).toHaveTextContent('A→Q→W');
  });

  it('no controle: analógico para a frente e para o lado + o gatilho do lado', () => {
    const pad = createPad(XBOX_ID, 0);
    const uninstall = installGamepads([pad]);
    render(<TurnPrompt snap={snap({ turn: turn(1) })} calm={false} />);
    setButton(pad, PAD.A, true);
    act(() => InputManager.get().poll(1));
    const keys = screen.getByTestId('turn-keys-pad');
    expect(keys).toHaveTextContent('L ↗');
    expect(keys).toHaveTextContent('RT');
    uninstall();
  });

  it('some longe do portal, fora da linha e depois de julgada', () => {
    const { container, rerender } = render(
      <TurnPrompt snap={snap({ turn: turn(5) })} calm={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<TurnPrompt snap={snap({ turn: turn(1), phase: 'TURN' })} calm={false} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <TurnPrompt snap={snap({ turn: { ...turn(0.1), judged: 'ON_TIME' } })} calm={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<TurnPrompt snap={snap({ turn: null })} calm={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('a barra vai de 2,5 s antes a 1 s depois do portal, com a janela no meio', () => {
    expect(turnBarPos(2.5)).toBe(0);
    expect(turnBarPos(-1)).toBe(1);
    expect(turnBarPos(10)).toBe(0);
    expect(turnBarPos(0)).toBeCloseTo(2.5 / 3.5, 9);
    expect(turnBarPos(WINDOW.earlyS)).toBeLessThan(turnBarPos(-WINDOW.lateS));
  });
});

describe('marca da curva, arremetida, vento vertical e dificuldade', () => {
  it('"CURVA NO TEMPO!" em verde; cedo em âmbar; perdida e lado errado em rosa', () => {
    const mark = (result: 'ON_TIME' | 'EARLY' | 'LATE' | 'WRONG_SIDE', seq: number) =>
      snap({ lastTurn: { result, side: 1, seq } });
    const { rerender } = render(<TurnMark snap={mark('ON_TIME', 1)} calm={false} />);
    expect(screen.getByTestId('hud-turn-mark')).toHaveTextContent('CURVA NO TEMPO!');
    expect(screen.getByTestId('hud-turn-mark')).toHaveClass('text-emerald-300', 'grade-pop');
    rerender(<TurnMark snap={mark('EARLY', 2)} calm />);
    expect(screen.getByTestId('hud-turn-mark')).toHaveTextContent('CEDO: ARREMETENDO');
    expect(screen.getByTestId('hud-turn-mark')).toHaveClass('text-amber-300', 'grade-fade');
    rerender(<TurnMark snap={mark('LATE', 3)} calm={false} />);
    expect(screen.getByTestId('hud-turn-mark')).toHaveTextContent('CURVA PERDIDA');
    rerender(<TurnMark snap={mark('WRONG_SIDE', 4)} calm={false} />);
    expect(screen.getByTestId('hud-turn-mark')).toHaveTextContent('LADO ERRADO');
    rerender(<TurnMark snap={{ ...mark('LATE', 5), phase: 'LANDING' }} calm={false} />);
    expect(screen.queryByTestId('hud-turn-mark')).not.toBeInTheDocument();
  });

  it('a arremetida mostra as curvas perdidas até o retorno automático', () => {
    const { rerender } = render(
      <GoAroundCard snap={snap({ phase: 'GO_AROUND', turnMisses: 1 })} />,
    );
    expect(screen.getByTestId('hud-go-around')).toHaveTextContent('curvas perdidas 1/3');
    rerender(<GoAroundCard snap={snap({ phase: 'RUN', turnMisses: 1 })} />);
    expect(screen.queryByTestId('hud-go-around')).not.toBeInTheDocument();
  });

  it('o vento vertical aparece acima de 0,3 m/s, em âmbar na rajada vertical', () => {
    const { rerender, container } = render(<VerticalWind snap={snap({ windVerticalMs: 0.2 })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<VerticalWind snap={snap({ windVerticalMs: -2.46 })} />);
    const w = screen.getByTestId('hud-vertical-wind');
    expect(w).toHaveTextContent('▼ 2,5 m/s');
    expect(w).toHaveAccessibleName('Corrente descendo');
    expect(w).toHaveClass('text-cyan-200');
    rerender(
      <VerticalWind
        snap={snap({
          windVerticalMs: 3,
          gust: { side: 1, axis: 'VERTICAL', inS: -0.2, active: true },
        })}
      />,
    );
    expect(screen.getByTestId('hud-vertical-wind')).toHaveClass('text-amber-300');
  });

  it('o selo da dificuldade', () => {
    render(<DifficultyChip difficulty="HARD" />);
    expect(screen.getByTestId('hud-difficulty')).toHaveTextContent('DIFÍCIL');
  });

  it('no HUD: o selo, o aviso perto da aeronave e os números da curva para o E2E', () => {
    render(<FlightHud snap={snap({ difficulty: 'EASY', turn: turn(1.2, -1), alerts: [] })} />);
    expect(screen.getByTestId('hud-difficulty')).toHaveTextContent('FÁCIL');
    expect(screen.getByTestId('hud-turn')).toBeInTheDocument();
    const hud = screen.getByTestId('flight-hud');
    expect(hud).toHaveAttribute('data-turn-side', '-1');
    expect(hud).toHaveAttribute('data-turn-to-gate', '1.20');
  });
});
