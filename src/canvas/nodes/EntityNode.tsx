import { Handle, Position as HandlePosition } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { AnchorHandle } from './AnchorHandle';
import { ShapeLabel } from './ShapeLabel';
import type { AppNode } from '../scene';

type EntityNodeProps = NodeProps<Extract<AppNode, { type: 'entity' }>>;

/** Handles on all four sides so a relationship can be dragged out anywhere. */
const SIDES = [
  HandlePosition.Top,
  HandlePosition.Right,
  HandlePosition.Bottom,
  HandlePosition.Left,
];

export function EntityNode({ id, data, selected }: EntityNodeProps): ReactElement {
  return (
    <div className={selected ? 'chen-shape chen-entity is-selected' : 'chen-shape chen-entity'}>
      <AnchorHandle />
      {SIDES.map((side) => (
        <Handle key={side} type="source" position={side} id={side} className="chen-handle" />
      ))}
      <ShapeLabel id={id} label={data.label} renaming={data.renaming} shape="rect" />
    </div>
  );
}
