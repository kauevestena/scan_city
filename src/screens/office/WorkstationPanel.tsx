import { Cpu, HardDrive, Monitor, Play, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { HARDWARE, STAFF } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { processingBaseTimeS, processingSpeed, processingTimeS } from '@/domain/processing';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import { useGameStore } from '@/state/store';
import type { MissionData } from '@/types';
import { Button, Panel, Tabs } from '@/ui';
import { HardwarePanel } from './HardwarePanel';

const W = STRINGS.office.workstation;

function pulses(mission: MissionData): number {
  return mission.lidar?.grid.pulses.reduce((s, p) => s + p, 0) ?? 0;
}

/** Workstation (office §5): a fila de processamento e a aba Hardware. */
export function WorkstationPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'QUEUE' | 'HARDWARE'>('QUEUE');
  const pending = useGameStore((s) => s.mission.pending);
  const hardwareId = useGameStore((s) => s.inventory.hardware);
  const staff = useGameStore((s) => s.staff);
  useFocusNavigation(ref, { onBack: onClose, initialFocus: 'process-0', autoFocus: true });
  const hardware =
    HARDWARE.find((h) => h.id === hardwareId) ?? (HARDWARE[0] as (typeof HARDWARE)[number]);
  const speed = processingSpeed(hardware, staff, STAFF, false);

  return (
    <div
      ref={ref}
      className="absolute top-0 right-0 bottom-0 w-80 overflow-y-auto p-3 min-[1600px]:w-[380px]"
      data-testid="workstation-panel"
    >
      <Panel
        title={W.title}
        icon={Monitor}
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            aria-label={STRINGS.office.close}
            onClick={onClose}
          />
        }
      >
        <Tabs
          tabs={[
            { id: 'QUEUE', label: W.queueTab, icon: Cpu },
            { id: 'HARDWARE', label: W.hardwareTab, icon: HardDrive },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'HARDWARE' && <HardwarePanel />}
        <ul className={tab === 'QUEUE' ? 'mt-3 flex flex-col gap-2' : 'hidden'}>
          {pending.length === 0 && <li className="text-sm text-slate-400">{W.empty}</li>}
          {pending.map((mission, i) => {
            const time = processingTimeS(
              processingBaseTimeS(mission.shots.length, pulses(mission)),
              speed,
            );
            return (
              <li
                key={mission.id}
                className="rounded-md border border-slate-700 bg-slate-800 p-3"
                data-mission={mission.id}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-100">{mission.contractId}</span>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {formatDateTime(mission.createdAt)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-300 tabular-nums">
                  {W.photos(mission.shots.length)}
                  {mission.lidar ? ` · ${W.pulses(formatNumber(pulses(mission), 0))}` : ''}
                </p>
                <p className="font-mono text-xs text-slate-400 tabular-nums">
                  {W.estimate(formatDuration(time))}
                </p>
                <Button
                  className="mt-2 w-full"
                  variant="primary"
                  icon={Play}
                  data-focus-id={`process-${i}`}
                  onClick={() =>
                    useGameStore
                      .getState()
                      .goTo('PROCESSING_RESULTS', { missionId: mission.id, inField: false })
                  }
                >
                  {W.process}
                </Button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
