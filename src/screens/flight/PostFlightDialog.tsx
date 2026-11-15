import { Inbox, Repeat, RotateCcw, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { STRINGS } from '@/data/strings';
import type { SortieResult } from '@/engines/flight/FlightEngine';
import { getAircraft } from '@/data/catalog';
import { canStartNewSortie } from '@/domain/sorties';
import { formatDuration, formatPct } from '@/lib/format';
import { useGameStore } from '@/state/store';
import { Button, ConfirmDialog, Modal, Stat } from '@/ui';

const P = STRINGS.flight.post;

export interface PostFlightDialogProps {
  result: SortieResult;
  totalLines: number;
  energyLeft: number;
  /** Chamado depois de `startNewSortie` na store, para remontar o voo. */
  onNewSortie?: () => void;
}

/** Pós-voo (survey-flight §5.12): resumo e destino dos dados. "Nova surtida" entra em T031. */
export function PostFlightDialog({
  result,
  totalLines,
  energyLeft,
  onNewSortie,
}: PostFlightDialogProps) {
  const mission = useGameStore((s) => s.mission.active);
  const hasVan = useGameStore((s) => s.inventory.vehicles.includes('LAB_VAN'));
  const inventory = useGameStore((s) => s.inventory);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  if (!mission) return null;
  const hasData = mission.shots.length > 0;
  const newSortieOk = canStartNewSortie(
    mission,
    getAircraft(mission.plan.params.aircraftId),
    inventory,
  );
  const lost = result.outcome === 'CRASH' || result.outcome === 'ENERGY_DEPLETED';

  const newSortie = () => {
    if (useGameStore.getState().startNewSortie()) onNewSortie?.();
  };
  const take = () => {
    const { queueActive, goTo } = useGameStore.getState();
    queueActive();
    goTo('WORLD_MAP', { outcome: 'QUEUED' });
  };
  const process = () =>
    useGameStore.getState().goTo('PROCESSING_RESULTS', { missionId: mission.id, inField: true });
  const retry = () => {
    const { resumePlanning, goTo } = useGameStore.getState();
    resumePlanning();
    goTo('FIELD_SETUP', { missionId: mission.id });
  };
  const abandon = () => {
    const { discardActive, goTo } = useGameStore.getState();
    goTo('WORLD_MAP', { outcome: 'ABORTED' });
    discardActive();
  };

  const footer = (
    <>
      <Button variant="ghost" icon={Trash2} onClick={() => setConfirmAbandon(true)}>
        {P.abandon}
      </Button>
      {!hasData && (
        <Button icon={RotateCcw} onClick={retry}>
          {P.retry}
        </Button>
      )}
      {newSortieOk && (
        <Button icon={Repeat} onClick={newSortie} data-testid="post-new-sortie">
          {P.newSortie}
        </Button>
      )}
      {hasData && hasVan && (
        <Button icon={Truck} onClick={process}>
          {P.process}
        </Button>
      )}
      {hasData && (
        <Button variant="primary" icon={Inbox} onClick={take} data-testid="post-take">
          {P.take}
        </Button>
      )}
    </>
  );

  return (
    <>
      <Modal open title={P.outcomes[result.outcome]} size="md" dismissable={false} footer={footer}>
        <div className="flex flex-col gap-4" data-testid="post-flight">
          {result.outcome === 'CRASH' && result.atlas && (
            <p className="text-sm text-amber-200" data-testid="atlas-scared">
              {P.atlasScared}
            </p>
          )}
          {lost && <p className="text-sm text-rose-300">{P.lost}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Stat label={P.lines} value={P.linesValue(mission.completedLines.length, totalLines)} />
            <Stat
              label={P.photos}
              value={<span data-testid="post-photos">{mission.shots.length}</span>}
            />
            <Stat label={P.time} value={formatDuration(result.durationS)} />
            <Stat label={P.energyLeft} value={formatPct(energyLeft, 0)} />
            <Stat
              label={P.collisions}
              value={<span data-testid="post-collisions">{mission.events.collisions}</span>}
            />
          </div>
        </div>
      </Modal>
      {confirmAbandon && (
        <ConfirmDialog
          title={P.abandonTitle}
          message={P.abandonMessage}
          confirmLabel={P.abandon}
          cancelLabel={P.keep}
          danger
          onConfirm={abandon}
          onCancel={() => setConfirmAbandon(false)}
        />
      )}
    </>
  );
}
