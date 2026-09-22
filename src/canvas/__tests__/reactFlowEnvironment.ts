/**
 * React Flow measures the DOM, which jsdom does not implement. These stubs give
 * it a fixed 1000x800 viewport so the canvas can be rendered in a test.
 *
 * Edges still do not appear: React Flow only draws them once nodes have been
 * measured for real. Edge rendering is covered by `scene.test.ts` (the geometry
 * and labels) and `CardinalityChip.test.tsx` (the interactive label).
 */
class ResizeObserverStub implements ResizeObserver {
  observe(): void {
    // jsdom never resizes anything.
  }
  unobserve(): void {
    // jsdom never resizes anything.
  }
  disconnect(): void {
    // jsdom never resizes anything.
  }
}

class DOMMatrixStub {
  m22 = 1;
}

const VIEWPORT: DOMRect = {
  x: 0,
  y: 0,
  width: 1000,
  height: 800,
  top: 0,
  left: 0,
  right: 1000,
  bottom: 800,
  toJSON: () => ({}),
};

export function installReactFlowEnvironment(): void {
  globalThis.ResizeObserver = ResizeObserverStub;
  globalThis.DOMMatrixReadOnly = DOMMatrixStub as unknown as typeof DOMMatrixReadOnly;

  Object.defineProperties(globalThis.HTMLElement.prototype, {
    offsetHeight: { get: () => VIEWPORT.height, configurable: true },
    offsetWidth: { get: () => VIEWPORT.width, configurable: true },
  });

  globalThis.HTMLElement.prototype.getBoundingClientRect = () => VIEWPORT;
}
