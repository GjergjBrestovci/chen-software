import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';
import { Canvas } from './canvas/Canvas';
import { ComponentMenu } from './ui/ComponentMenu';
import { Notice } from './ui/Notice';
import { useUiStore } from './store/uiStore';

export function App(): ReactElement {
  const theme = useUiStore((state) => state.theme);

  // Set on the root element so the whole page, not just the canvas, follows it.
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  return (
    <ReactFlowProvider>
      <div className="chen-app">
        <Canvas />
        <ComponentMenu />
        <Notice />
      </div>
    </ReactFlowProvider>
  );
}
