import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';
import { Canvas } from './canvas/Canvas';
import { Notice } from './ui/Notice';

export function App(): ReactElement {
  return (
    <ReactFlowProvider>
      <div className="chen-app">
        <Canvas />
        <Notice />
      </div>
    </ReactFlowProvider>
  );
}
