import { EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { CardinalityChip } from './CardinalityChip';
import type { AppEdge } from '../scene';

/**
 * A plain Chen line: no arrowheads, drawn between the two shape *boundaries*
 * (SPEC.md §5). The endpoints are computed in `canvas/scene.ts` with the pure
 * `geometry/` functions, so this component only draws.
 */
type ChenEdgeProps = EdgeProps<AppEdge>;

export function ChenEdge({ data }: ChenEdgeProps): ReactElement | null {
  if (!data) {
    return null;
  }

  const { segment, label } = data;

  return (
    <>
      <line
        className="chen-edge"
        x1={segment.start.x}
        y1={segment.start.y}
        x2={segment.end.x}
        y2={segment.end.y}
      />
      {label && (
        <EdgeLabelRenderer>
          <CardinalityChip label={label} />
        </EdgeLabelRenderer>
      )}
    </>
  );
}
