import { Inbox, Repeat, RotateCcw, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { STRINGS } from '@/data/strings';
import type { SortieResult } from '@/engines/flight/FlightEngine';
import { getAircraft } from '@/data/catalog';
import { plannedSamples } from '@/domain/corridor';
import { gradeLetter, missionExecution, passValue } from '@/domain/execution';
import { canStartNewSortie, missionHasData } from '@/domain/sorties';
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
  const hasData = missionHasData(mission);
  const newSortieOk = canStartNewSortie(
    mission,
    getAircraft(mission.plan.params.aircraftId),
    inventory,
  );
  const lost = result.outcome === 'CRASH' || result.outcome === 'ENERGY_DEPLETED';
  // A nota de cada linha voada nesta surtida (a melhor passada) e a execução da missão.
  const planned = mission.plan.lines.map((l) => plannedSamples(l, mission.plan.stats.baseM));
  const best = new Map<number, number>();
  for (const p of result.linePasses) {
    const v = passValue(p, planned[p.lineIndex] ?? 0);
    best.set(p.lineIndex, Math.max(best.get(p.lineIndex) ?? 0, v));
  }
  const lineGrades = [...best.entries()].sort((a, b) => a[0] - b[0]);
  const execution = mission.linePasses ? missionExecution(mission.linePasses, planned) : null;

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
          {lineGrades.length > 0 && (
            <section data-testid="post-execution">
              <h3 className="mb-1 text-xs font-semibold tracking-widest text-slate-400 uppercase">
                {P.execution}
              </h3>
              <ul className="grid grid-cols-2 gap-x-4 text-sm text-slate-200">
                {lineGrades.map(([line, v]) => (
                  <li key={line} data-refly={result.refly.includes(line)}>
                    {P.lineGrade(line + 1, gradeLetter(v), Math.round(v * 100))}
                    {result.refly.includes(line) && (
                      <span className="ml-2 text-xs font-semibold text-rose-300">{P.toRefly}</span>
                    )}
                  </li>
                ))}
              </ul>
              {execution !== null && (
                <p className="mt-1 text-xs text-slate-400">
                  {P.missionExecution(Math.round(execution * 100))}
                </p>
              )}
            </section>
          )}
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
