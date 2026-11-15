/** O voo de uma fenda ganha a moldura violeta no HUD (T059), na R01 do catálogo. */
import { act, render, screen, waitFor } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { SurveyFlightScreen } from './SurveyFlightScreen';

const get = () => useGameStore.getState();

async function fly(contractId: string) {
  act(() => {
    get().goTo('WORLD_MAP');
    get().startMission(contractId, 1);
    get().launchMission();
  });
  useGameStore.setState((s) => ({
    session: { ...s.session, screen: 'SURVEY_FLIGHT' },
    settings: { ...s.settings, quality: 'LOW' },
  }));
  render(<SurveyFlightScreen />);
  await waitFor(() => expect(screen.getByTestId('flight-hud')).toBeInTheDocument(), {
    timeout: 4000,
  });
}

beforeEach(() => resetGameStore());

describe('SurveyFlightScreen — moldura de fenda', () => {
  it('numa fenda, o HUD vem com a moldura violeta', async () => {
    await fly('R01');
    expect(screen.getByTestId('flight-hud')).toHaveAttribute('data-rift', 'true');
    expect(screen.getByTestId('rift-hud-frame')).toBeInTheDocument();
  });

  it('num contrato do Mundo Real, sem moldura', async () => {
    await fly('C00');
    expect(screen.getByTestId('flight-hud')).toHaveAttribute('data-rift', 'false');
    expect(screen.queryByTestId('rift-hud-frame')).not.toBeInTheDocument();
  });
});
