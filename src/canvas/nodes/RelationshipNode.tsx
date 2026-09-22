import type { NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { AnchorHandle } from './AnchorHandle';
import { componentStyle } from './componentStyle';
import { ShapeLabel } from './ShapeLabel';
import type { AppNode } from '../scene';

type RelationshipNodeProps = NodeProps<Extract<AppNode, { type: 'relationship' }>>;

/**
 * A diamond drawn as an SVG polygon rather than a rotated square, so the label
 * stays upright and the outline matches `geometry/shapes.ts` exactly.
 */
export function RelationshipNode({
  id,
  data,
  selected,
  width = 0,
  height = 0,
}: RelationshipNodeProps): ReactElement {
  return (
    <div
      className={
        selected ? 'chen-shape chen-relationship is-selected' : 'chen-shape chen-relationship'
      }
      style={componentStyle(data.color)}
    >
      <AnchorHandle />
      <svg className="chen-shape-outline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polygon
          points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
        />
      </svg>
      <ShapeLabel id={id} label={data.label} renaming={data.renaming} shape="diamond" />
    </div>
  );
}
