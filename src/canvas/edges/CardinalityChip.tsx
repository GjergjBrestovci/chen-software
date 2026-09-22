import type { ReactElement } from 'react';
import { messages } from '../../i18n/messages.en';
import { useDocumentStore } from '../../store/documentStore';
import type { CardinalityLabel } from '../scene';

/**
 * The `1`, `N` or `M` beside an entity. An undecided end is a dashed `?`
 * placeholder, and clicking cycles `? -> 1 -> N -> M -> 1` (SPEC.md §5).
 *
 * It only ever changes the end the student clicked. Nothing else in the model
 * moves with it (SPEC.md §1.1).
 */
export interface CardinalityChipProps {
  label: CardinalityLabel;
}

export function CardinalityChip({ label }: CardinalityChipProps): ReactElement {
  const cycleCardinality = useDocumentStore((state) => state.cycleCardinality);
  const unset = label.value === null;

  return (
    <button
      type="button"
      className={unset ? 'chen-cardinality chen-cardinality--unset' : 'chen-cardinality'}
      style={{
        transform: `translate(-50%, -50%) translate(${label.position.x}px, ${label.position.y}px)`,
      }}
      onClick={(event) => {
        event.stopPropagation();
        cycleCardinality(label.relationshipId, label.endIndex);
      }}
      title={messages.canvas.cardinalityHint}
      aria-label={
        unset
          ? messages.canvas.cardinalityUnsetLabel
          : messages.canvas.cardinalitySetLabel(label.value ?? '')
      }
    >
      {label.value ?? messages.canvas.cardinalityPlaceholder}
    </button>
  );
}
