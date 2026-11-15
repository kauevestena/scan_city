import { FINALE_LINES, GRANDPA_LETTER } from '@/data/office';
import { STRINGS } from '@/data/strings';
import { DialogueBox, Modal } from '@/ui';

/**
 * Final da campanha (REQ-CNT-008): a carta do avô encontrada na caderneta e a inauguração do
 * Grande Museu da Terra, em 4 cartões. Aparece uma única vez, ao entrar no escritório com os 7
 * contratos reais concluídos (`finaleDue`); ao terminar, a store entrega o chapéu do avô.
 */
export function FinaleSequence({ onDone }: { onDone: () => void }) {
  return (
    <Modal open title={STRINGS.office.finaleTitle} dismissable={false} size="lg">
      <DialogueBox speaker={GRANDPA_LETTER} lines={FINALE_LINES} onDone={onDone} />
    </Modal>
  );
}
