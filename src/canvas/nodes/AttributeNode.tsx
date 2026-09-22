import type { NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { AnchorHandle } from './AnchorHandle';
import { AttributeMarkers } from './AttributeMarkers';
import { componentStyle } from './componentStyle';
import { ShapeLabel } from './ShapeLabel';
import type { AppNode } from '../scene';

type AttributeNodeProps = NodeProps<Extract<AppNode, { type: 'attribute' }>>;

export function AttributeNode({
  id,
  data,
  selected,
  width = 0,
  height = 0,
}: AttributeNodeProps): ReactElement {
  return (
    <div
      className={selected ? 'chen-shape chen-attribute is-selected' : 'chen-shape chen-attribute'}
      style={componentStyle(data.color)}
    >
      <AttributeMarkers
        size={{ width, height }}
        isPrimaryKey={data.isPrimaryKey}
        isForeignKey={data.isForeignKey}
      />
      <AnchorHandle />
      <ShapeLabel
        id={id}
        label={data.label}
        renaming={data.renaming}
        shape="ellipse"
        underline={data.isKey}
        dashedUnderline={data.isPartialKey}
      />
    </div>
  );
}
