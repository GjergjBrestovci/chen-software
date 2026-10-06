import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PDF_OPTIONS } from '../../export/pdfOptions';
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

describe('uiStore theme', () => {
  beforeEach(() => {
    useUiStore.setState({ theme: 'light' });
  });

  it('toggles between light and dark', () => {
    store().toggleTheme();
    expect(store().theme).toBe('dark');
    store().toggleTheme();
    expect(store().theme).toBe('light');
  });
});

describe('uiStore PDF export', () => {
  beforeEach(() => {
    useUiStore.setState({ exportDialogOpen: false, pdfOptions: DEFAULT_PDF_OPTIONS });
  });

  it('opens and closes the export dialog', () => {
    store().openExportDialog();
    expect(store().exportDialogOpen).toBe(true);
    store().closeExportDialog();
    expect(store().exportDialogOpen).toBe(false);
  });

  it('starts from the default options', () => {
    expect(store().pdfOptions).toEqual(DEFAULT_PDF_OPTIONS);
  });

  it('changes one option without disturbing the others', () => {
    store().setPdfOptions({ studentName: 'Ada' });
    store().setPdfOptions({ pageSize: 'letter' });
    expect(store().pdfOptions).toEqual({
      ...DEFAULT_PDF_OPTIONS,
      studentName: 'Ada',
      pageSize: 'letter',
    });
  });
});
