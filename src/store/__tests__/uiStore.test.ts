import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../uiStore';

const store = (): ReturnType<typeof useUiStore.getState> => useUiStore.getState();

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedIds: [],
      renamingId: null,
      relationshipMode: { active: false, firstEntityId: null },
      notice: null,
      snapToGrid: true,
    });
  });

  it('tracks selection', () => {
    store().setSelectedIds(['a', 'b']);
    expect(store().selectedIds).toEqual(['a', 'b']);
  });

  it('copies the selection rather than aliasing the caller array', () => {
    const ids = ['a'];
    store().setSelectedIds(ids);
    ids.push('b');
    expect(store().selectedIds).toEqual(['a']);
  });

  it('tracks which element is being renamed', () => {
    store().startRenaming('a');
    expect(store().renamingId).toBe('a');
    store().stopRenaming();
    expect(store().renamingId).toBeNull();
  });

  it('arms and disarms relationship mode', () => {
    store().toggleRelationshipMode();
    expect(store().relationshipMode).toEqual({ active: true, firstEntityId: null });
    store().toggleRelationshipMode();
    expect(store().relationshipMode.active).toBe(false);
  });

  it('remembers the first entity picked, then clears on cancel', () => {
    store().toggleRelationshipMode();
    store().armRelationshipFrom('book');
    expect(store().relationshipMode.firstEntityId).toBe('book');
    store().cancelRelationshipMode();
    expect(store().relationshipMode).toEqual({ active: false, firstEntityId: null });
  });

  it('forgets a half-finished pick when the mode is toggled off', () => {
    store().toggleRelationshipMode();
    store().armRelationshipFrom('book');
    store().toggleRelationshipMode();
    expect(store().relationshipMode.firstEntityId).toBeNull();
  });

  it('toggles snap to grid', () => {
    const initial = store().snapToGrid;
    store().toggleSnapToGrid();
    expect(store().snapToGrid).toBe(!initial);
  });

  it('shows and dismisses a notice', () => {
    store().notify('A relationship needs two different entities.');
    expect(store().notice).toContain('two different entities');
    store().dismissNotice();
    expect(store().notice).toBeNull();
  });
});

describe('uiStore theme and context menu', () => {
  beforeEach(() => {
    useUiStore.setState({ theme: 'light', contextMenu: null });
  });

  it('toggles between light and dark', () => {
    store().toggleTheme();
    expect(store().theme).toBe('dark');
    store().toggleTheme();
    expect(store().theme).toBe('light');
  });

  it('opens the context menu on a component at a position', () => {
    store().openContextMenu({ elementId: 'book', x: 10, y: 20 });
    expect(store().contextMenu).toEqual({ elementId: 'book', x: 10, y: 20 });
  });

  it('closes the context menu', () => {
    store().openContextMenu({ elementId: 'book', x: 10, y: 20 });
    store().closeContextMenu();
    expect(store().contextMenu).toBeNull();
  });

  it('moves the menu to whichever component was right-clicked last', () => {
    store().openContextMenu({ elementId: 'book', x: 10, y: 20 });
    store().openContextMenu({ elementId: 'author', x: 30, y: 40 });
    expect(store().contextMenu?.elementId).toBe('author');
  });
});
