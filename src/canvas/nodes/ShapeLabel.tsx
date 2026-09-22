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
  /** A weak entity's partial key is underlined with a dashed rule (SPEC.md §6). */
  dashedUnderline?: boolean;
}

function labelClassName(underline: boolean, dashed: boolean): string {
  if (!underline) return 'chen-label';
  return dashed ? 'chen-label chen-label--partial-key' : 'chen-label chen-label--key';
}

export function ShapeLabel({
  id,
  label,
  renaming,
  shape,
  underline = false,
  dashedUnderline = false,
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
    <span className={labelClassName(underline, dashedUnderline)} style={{ fontSize }}>
      {label}
    </span>
  );
}
