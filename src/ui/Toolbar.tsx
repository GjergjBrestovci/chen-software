import type { ReactElement } from 'react';
import { messages } from '../i18n/messages.en';
import type { Theme } from '../store/uiStore';

/**
 * Every button carries a label and a tooltip naming its shortcut, and the
 * relationship and snap toggles report their state through `aria-pressed`
 * rather than colour alone (SPEC.md §10).
 */
export interface ToolbarProps {
  onNewDiagram: () => void;
  onOpenDiagram: () => void;
  onSaveDiagram: () => void;
  hasUnsavedChanges: boolean;
  onNewEntity: () => void;
  onAddAttribute: () => void;
  onToggleRelationshipMode: () => void;
  onDeleteSelection: () => void;
  onToggleSnap: () => void;
  onToggleTheme: () => void;
  theme: Theme;
  onUndo: () => void;
  onRedo: () => void;
  relationshipModeActive: boolean;
  snapToGrid: boolean;
  canAddAttribute: boolean;
  canDelete: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

function withShortcut(label: string, key: string): string {
  return `${label}${messages.toolbar.shortcutSuffix(key)}`;
}

export function Toolbar(props: ToolbarProps): ReactElement {
  const { toolbar } = messages;

  return (
    <div className="chen-toolbar" role="toolbar" aria-label={messages.app.title}>
      <button
        type="button"
        onClick={props.onNewDiagram}
        title={messages.file.newDiagram}
        aria-label={messages.file.newDiagram}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--new" />
        {messages.file.newDiagram}
      </button>

      <button
        type="button"
        onClick={props.onOpenDiagram}
        title={messages.file.open}
        aria-label={messages.file.open}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--open" />
        {messages.file.open}
      </button>

      <button
        type="button"
        onClick={props.onSaveDiagram}
        title={withShortcut(messages.file.save, messages.file.saveShortcut)}
        aria-label={withShortcut(messages.file.save, messages.file.saveShortcut)}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--save" />
        {messages.file.save}
        {props.hasUnsavedChanges && (
          <span className="chen-unsaved" aria-hidden="true" title={messages.file.save} />
        )}
      </button>

      <span className="chen-toolbar-separator" aria-hidden="true" />

      <button
        type="button"
        onClick={props.onNewEntity}
        title={withShortcut(toolbar.addEntity, toolbar.addEntityShortcut)}
        aria-label={withShortcut(toolbar.addEntity, toolbar.addEntityShortcut)}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--entity" />
        {toolbar.addEntity}
      </button>

      <button
        type="button"
        onClick={props.onAddAttribute}
        disabled={!props.canAddAttribute}
        title={withShortcut(toolbar.addAttribute, toolbar.addAttributeShortcut)}
        aria-label={withShortcut(toolbar.addAttribute, toolbar.addAttributeShortcut)}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--attribute" />
        {toolbar.addAttribute}
      </button>

      <button
        type="button"
        onClick={props.onToggleRelationshipMode}
        aria-pressed={props.relationshipModeActive}
        title={withShortcut(toolbar.relationshipMode, toolbar.relationshipModeShortcut)}
        aria-label={withShortcut(toolbar.relationshipMode, toolbar.relationshipModeShortcut)}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--relationship" />
        {toolbar.relationshipMode}
      </button>

      <button
        type="button"
        onClick={props.onDeleteSelection}
        disabled={!props.canDelete}
        title={withShortcut(toolbar.deleteSelection, toolbar.deleteSelectionShortcut)}
        aria-label={withShortcut(toolbar.deleteSelection, toolbar.deleteSelectionShortcut)}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--delete" />
        {toolbar.deleteSelection}
      </button>

      <span className="chen-toolbar-separator" aria-hidden="true" />

      <button
        type="button"
        onClick={props.onUndo}
        disabled={!props.canUndo}
        title={withShortcut(toolbar.undo, toolbar.undoShortcut)}
        aria-label={withShortcut(toolbar.undo, toolbar.undoShortcut)}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--undo" />
        {toolbar.undo}
      </button>

      <button
        type="button"
        onClick={props.onRedo}
        disabled={!props.canRedo}
        title={withShortcut(toolbar.redo, toolbar.redoShortcut)}
        aria-label={withShortcut(toolbar.redo, toolbar.redoShortcut)}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--redo" />
        {toolbar.redo}
      </button>

      <label className="chen-toolbar-toggle">
        <input type="checkbox" checked={props.snapToGrid} onChange={props.onToggleSnap} />
        {toolbar.snapToGrid}
      </label>

      <button
        type="button"
        onClick={props.onToggleTheme}
        aria-pressed={props.theme === 'dark'}
        title={toolbar.darkTheme}
        aria-label={toolbar.darkTheme}
      >
        <span aria-hidden="true" className="chen-icon chen-icon--theme" />
        {props.theme === 'dark' ? toolbar.lightMode : toolbar.darkMode}
      </button>
    </div>
  );
}
