import { GRANDPA_LETTER, INTRO_LINES } from '@/data/office';
import { STRINGS } from '@/data/strings';
import { DialogueBox, Modal } from '@/ui';

/** Introdução narrativa (REQ-OFF-007): a carta do avô em 4 cartões. */
export function IntroSequence({ onDone }: { onDone: () => void }) {
  return (
    <Modal open title={STRINGS.office.introTitle} dismissable={false} size="lg">
      <DialogueBox speaker={GRANDPA_LETTER} lines={INTRO_LINES} onDone={onDone} />
    </Modal>
  );
}
