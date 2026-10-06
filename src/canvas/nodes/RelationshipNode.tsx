import type { NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { insetBox } from '../../geometry';
import { AnchorHandle } from './AnchorHandle';
import { componentStyle } from './componentStyle';
import { ShapeLabel } from './ShapeLabel';
import type { AppNode } from '../scene';

type RelationshipNodeProps = NodeProps<Extract<AppNode, { type: 'relationship' }>>;

/** A diamond of `width` x `height` centred in a box of `boxWidth` x `boxHeight`. */
function diamondPoints(width: number, height: number, boxWidth: number, boxHeight: number): string {
  const cx = boxWidth / 2;
  const cy = boxHeight / 2;
  const hw = width / 2;
  const hh = height / 2;
  return `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
}

/** An identifying relationship's inner outline, the same inset the export uses. */
function InnerDiamond({ width, height }: { width: number; height: number }): ReactElement {
  const inner = insetBox({ kind: 'diamond', center: { x: 0, y: 0 }, size: { width, height } });
  return (
    <polygon
      className="chen-shape-inner"
      points={diamondPoints(inner.size.width, inner.size.height, width, height)}
    />
  );
}

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
        <polygon points={diamondPoints(width, height, width, height)} />
        {data.doubled && <InnerDiamond width={width} height={height} />}
      </svg>
      <ShapeLabel id={id} label={data.label} renaming={data.renaming} shape="diamond" />
    </div>
  );
}
