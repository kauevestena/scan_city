import { act, render, screen } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import type { ScreenId } from '@/types';
import { resetGameStore } from '@/test/resetStore';
import {
  inRiftContext,
  ScreenTransition,
  transitionKind,
  SCREEN_FADE_MS,
} from './ScreenTransition';

const get = () => useGameStore.getState();
const wrapper = () => screen.getByTestId('screen-transition');

/** Abre o planejamento de campo do contrato (o payload da T6 leva o ajuste da rival). */
function openFieldSetup(contractId: string) {
  act(() => {
    useGameStore.setState((s) => ({
      session: {
        ...s.session,
        screen: 'FIELD_SETUP',
        payload: { contractId, rivalAdjustment: 1 },
      },
    }));
  });
}

function goTo(screenId: ScreenId) {
  act(() => {
    useGameStore.setState((s) => ({
      session: { ...s.session, screen: screenId, payload: undefined },
    }));
  });
}

beforeEach(() => resetGameStore());

describe('transitionKind', () => {
  it('fade simples; com a fenda de um lado, a distorção; com reduzir flashes, só o fade', () => {
    expect(transitionKind(false, false, false)).toBe('FADE');
    expect(transitionKind(true, false, false)).toBe('RIFT');
    expect(transitionKind(false, true, false)).toBe('RIFT');
    expect(transitionKind(true, true, false)).toBe('RIFT');
    expect(transitionKind(true, true, true)).toBe('FADE');
    expect(transitionKind(false, true, true)).toBe('FADE');
  });

  it('o fade dura 200 ms', () => {
    expect(SCREEN_FADE_MS).toBe(200);
  });
});

describe('inRiftContext', () => {
  it('o mapa na aba Fendas, e as telas da missão de uma fenda; o resto, não', () => {
    expect(inRiftContext(get())).toBe(false);
    act(() => {
      useGameStore.setState((s) => ({
        session: { ...s.session, screen: 'WORLD_MAP' },
        world: { ...s.world, dimensionTab: 'RIFT', discoveredRifts: ['R01'] },
      }));
    });
    expect(inRiftContext(get())).toBe(true);
    act(() => {
      useGameStore.setState((s) => ({ world: { ...s.world, dimensionTab: 'REAL' } }));
    });
    expect(inRiftContext(get())).toBe(false);
    for (const [screenId, payload, expected] of [
      ['FIELD_SETUP', { contractId: 'R01' }, true],
      ['FIELD_SETUP', { contractId: 'C00' }, false],
      ['SURVEY_FLIGHT', { missionId: 'x' }, false],
      ['HOLO_TABLE_VIEW', { focusSectorId: 'R01' }, false],
      ['OFFICE', undefined, false],
      ['INFOGRAPHIC_LAB', undefined, false],
    ] as const) {
      act(() => {
        useGameStore.setState((s) => ({
          session: { ...s.session, screen: screenId, payload },
        }));
      });
      expect(inRiftContext(get()), `${screenId} ${JSON.stringify(payload)}`).toBe(expected);
    }
  });

  it('o voo e o processamento acham o contrato pela missão (ativa ou pendente)', () => {
    const mission = (id: string, contractId: string) =>
      ({ id, contractId, status: 'IN_FLIGHT' }) as never;
    act(() => {
      useGameStore.setState((s) => ({
        mission: {
          ...s.mission,
          active: mission('m-active', 'R01'),
          pending: [mission('m-pending', 'C00')],
        },
        session: { ...s.session, screen: 'SURVEY_FLIGHT', payload: { missionId: 'm-active' } },
      }));
    });
    expect(inRiftContext(get())).toBe(true);
    act(() => {
      useGameStore.setState((s) => ({
        session: {
          ...s.session,
          screen: 'PROCESSING_RESULTS',
          payload: { missionId: 'm-pending', inField: false },
        },
      }));
    });
    expect(inRiftContext(get())).toBe(false);
  });
});

describe('ScreenTransition', () => {
  it('a abertura do jogo entra sem fade', () => {
    render(
      <ScreenTransition>
        <p>conteúdo</p>
      </ScreenTransition>,
    );
    expect(wrapper()).toHaveAttribute('data-transition', 'NONE');
    expect(wrapper().className).not.toContain('screen-fade');
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('cada troca de tela entra com fade de 200 ms (a classe `screen-fade`)', () => {
    render(
      <ScreenTransition>
        <p>conteúdo</p>
      </ScreenTransition>,
    );
    const first = wrapper();
    goTo('WORLD_MAP');
    expect(wrapper()).toHaveAttribute('data-transition', 'FADE');
    expect(wrapper()).toHaveClass('screen-fade');
    // O quadro é remontado (a animação recomeça a cada troca).
    expect(wrapper()).not.toBe(first);
  });

  it('entrar na fenda (planejamento de um contrato de fenda) ganha a distorção', () => {
    render(
      <ScreenTransition>
        <p>conteúdo</p>
      </ScreenTransition>,
    );
    goTo('WORLD_MAP');
    openFieldSetup('R01');
    expect(wrapper()).toHaveAttribute('data-transition', 'RIFT');
    expect(wrapper()).toHaveClass('screen-rift');
    // Sair dela também; de um contrato real para outra tela, só o fade.
    goTo('WORLD_MAP');
    expect(wrapper()).toHaveAttribute('data-transition', 'RIFT');
    goTo('OFFICE');
    expect(wrapper()).toHaveAttribute('data-transition', 'FADE');
  });

  it('o mapa na aba Fendas distorce ao sair; trocar de aba no próprio mapa não é transição', () => {
    render(
      <ScreenTransition>
        <p>conteúdo</p>
      </ScreenTransition>,
    );
    goTo('WORLD_MAP');
    const mapFrame = wrapper();
    act(() => {
      useGameStore.setState((s) => ({
        world: { ...s.world, dimensionTab: 'RIFT', discoveredRifts: ['R01'] },
      }));
    });
    expect(wrapper()).toBe(mapFrame);
    goTo('OFFICE');
    expect(wrapper()).toHaveAttribute('data-transition', 'RIFT');
  });

  it('com "Reduzir flashes e tremores" a distorção vira só o fade', () => {
    useGameStore.setState((s) => ({ settings: { ...s.settings, reduceFlashes: true } }));
    render(
      <ScreenTransition>
        <p>conteúdo</p>
      </ScreenTransition>,
    );
    goTo('WORLD_MAP');
    openFieldSetup('R01');
    expect(wrapper()).toHaveAttribute('data-transition', 'FADE');
    expect(wrapper()).not.toHaveClass('screen-rift');
  });
});
