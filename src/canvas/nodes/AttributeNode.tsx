import type { NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { AnchorHandle } from './AnchorHandle';
import { ShapeLabel } from './ShapeLabel';
import type { AppNode } from '../scene';

type AttributeNodeProps = NodeProps<Extract<AppNode, { type: 'attribute' }>>;

export function AttributeNode({ id, data, selected }: AttributeNodeProps): ReactElement {
  return (
    <div
      className={selected ? 'chen-shape chen-attribute is-selected' : 'chen-shape chen-attribute'}
    >
      <AnchorHandle />
      <ShapeLabel
        id={id}
        label={data.label}
        renaming={data.renaming}
        shape="ellipse"
        underline={data.isKey}
      />
    </div>
  );
}
