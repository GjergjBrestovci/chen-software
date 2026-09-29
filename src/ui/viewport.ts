/** Keeps a floating panel inside the window when opened near an edge. */
export function clampToViewport(element: HTMLElement, x: number, y: number): void {
  const { offsetWidth, offsetHeight } = element;
  const maxX = globalThis.innerWidth - offsetWidth - 8;
  const maxY = globalThis.innerHeight - offsetHeight - 8;
  element.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
  element.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
}
