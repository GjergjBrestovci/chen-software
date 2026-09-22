import type { ReactElement } from 'react';
import { InlineName } from './InlineName';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';
import { fontSizeFor } from '../../geometry';
import type { ShapeKind } from '../../geometry';

/**
 * The name drawn inside a shape, or the rename input when this element is
 * being renamed. `underline` marks a key attribute (SPEC.md §5).
 */
export interface ShapeLabelProps {
  id: string;
  label: string;
  renaming: boolean;
  shape: ShapeKind;
  underline?: boolean;
}

export function ShapeLabel({
  id,
  label,
  renaming,
  shape,
  underline = false,
}: ShapeLabelProps): ReactElement {
  const rename = useDocumentStore((state) => state.rename);
  const stopRenaming = useUiStore((state) => state.stopRenaming);
  const fontSize = fontSizeFor(shape);

  if (renaming) {
    return (
      <InlineName
        value={label}
        fontSize={fontSize}
        onCommit={(name) => {
          rename(id, name);
          stopRenaming();
        }}
        onCancel={stopRenaming}
      />
    );
  }

  return (
    <span className={underline ? 'chen-label chen-label--key' : 'chen-label'} style={{ fontSize }}>
      {label}
    </span>
  );
}
