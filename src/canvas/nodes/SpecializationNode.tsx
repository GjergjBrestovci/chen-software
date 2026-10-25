import type { NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { AnchorHandle } from './AnchorHandle';
import { componentStyle } from './componentStyle';
import { ShapeLabel } from './ShapeLabel';
import type { AppNode } from '../scene';

type SpecializationNodeProps = NodeProps<Extract<AppNode, { type: 'specialization' }>>;

/** An apex-up triangle of `width` x `height` centred in a box of `boxWidth` x `boxHeight`. */
function trianglePoints(
  width: number,
  height: number,
  boxWidth: number,
  boxHeight: number,
): string {
  const cx = boxWidth / 2;
  const cy = boxHeight / 2;
  const hw = width / 2;
  const hh = height / 2;
  return `${cx},${cy - hh} ${cx + hw},${cy + hh} ${cx - hw},${cy + hh}`;
}

/**
 * The ISA node: an apex-up triangle drawn as an SVG polygon, matching
 * `geometry/shapes.ts` exactly, with the course's (t,d) constraint text
 * floating above the apex (data-modeling lesson 05).
 */
export function SpecializationNode({
  id,
  data,
  selected,
  width = 0,
  height = 0,
}: SpecializationNodeProps): ReactElement {
  return (
    <div
      className={
        selected ? 'chen-shape chen-specialization is-selected' : 'chen-shape chen-specialization'
      }
      style={componentStyle(data.color)}
    >
      <AnchorHandle />
      <svg className="chen-shape-outline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polygon points={trianglePoints(width, height, width, height)} />
      </svg>
      <ShapeLabel id={id} label={data.label} renaming={data.renaming} shape="triangle" />
      <span className="chen-isa-constraint">{data.constraint}</span>
    </div>
  );
}
