import { Handle, Position } from '@xyflow/react';
import type { ReactElement } from 'react';

/**
 * Every node needs a handle React Flow can resolve an edge to, including
 * relationships and attributes, which the student never drags a connection
 * from. This one is inert and invisible: it exists so edges render, while the
 * line itself is drawn from `geometry/` in `ChenEdge`.
 */
export const ANCHOR_HANDLE_ID = 'anchor';

export function AnchorHandle(): ReactElement {
  return (
    <Handle
      type="source"
      position={Position.Top}
      id={ANCHOR_HANDLE_ID}
      isConnectable={false}
      className="chen-handle chen-handle--anchor"
    />
  );
}
