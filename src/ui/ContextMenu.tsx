import { useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';

/**
 * A menu anchored at a screen position.
 *
 * Presentational only: it knows about focus, dismissal and staying on screen,
 * and nothing about diagrams. Escape closes it, a click elsewhere closes it,
 * and the arrow keys move between items, which is what SPEC.md §10 asks for.
 */
export interface ContextMenuProps {
  x: number;
  y: number;
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** Keeps the menu inside the window when opened near an edge. */
function clampToViewport(element: HTMLElement, x: number, y: number): void {
  const { offsetWidth, offsetHeight } = element;
  const maxX = globalThis.innerWidth - offsetWidth - 8;
  const maxY = globalThis.innerHeight - offsetHeight - 8;
  element.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
  element.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
}

function focusableItems(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-menu-item]:not(:disabled)')];
}

export function ContextMenu({ x, y, label, onClose, children }: ContextMenuProps): ReactElement {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    clampToViewport(menu, x, y);
    focusableItems(menu)[0]?.focus();
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return;
      }
      onClose();
    };

    // Capture, so the canvas underneath never also acts on the click.
    globalThis.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      globalThis.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // The canvas listens on window; nothing typed in here is a shortcut.
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    event.preventDefault();
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const items = focusableItems(menu);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = items[(current + step + items.length) % items.length];
    next?.focus();
  };

  return (
    <div
      ref={menuRef}
      className="chen-context-menu"
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

export function MenuGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="chen-menu-group" role="group" aria-label={label}>
      <span className="chen-menu-group-label">{label}</span>
      <div className="chen-menu-row">{children}</div>
    </div>
  );
}

export interface MenuItemProps {
  label: string;
  onSelect: () => void;
  /** Present for a state item: one of a set (radio) or an on/off toggle. */
  pressed?: boolean;
  toggle?: boolean;
  danger?: boolean;
}

export function MenuItem({
  label,
  onSelect,
  pressed,
  toggle,
  danger,
}: MenuItemProps): ReactElement {
  const role = pressed === undefined ? 'menuitem' : toggle ? 'menuitemcheckbox' : 'menuitemradio';

  return (
    <button
      type="button"
      data-menu-item
      role={role}
      aria-checked={pressed}
      className={danger ? 'chen-menu-item chen-menu-item--danger' : 'chen-menu-item'}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}
