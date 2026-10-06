import { useRef } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';

/**
 * A menu docked in the sidebar.
 *
 * Presentational only: it knows about keyboard movement and nothing about
 * diagrams. The arrow keys move between items, which is what SPEC.md §10 asks
 * for. Other keys reach the canvas shortcuts, so Delete and Ctrl+Z still work
 * after clicking an item.
 */
export interface MenuPanelProps {
  label: string;
  children: ReactNode;
}

function focusableItems(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-menu-item]:not(:disabled)')];
}

export function MenuPanel({ label, children }: MenuPanelProps): ReactElement {
  const menuRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
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
    <div ref={menuRef} className="chen-menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
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
