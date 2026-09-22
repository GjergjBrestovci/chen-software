import type { ReactElement } from 'react';
import { messages } from '../i18n/messages.en';

/**
 * Every button carries a label and a tooltip naming its shortcut, and the
 * relationship and snap toggles report their state through `aria-pressed`
 * rather than colour alone (SPEC.md §10).
 */
export interface ToolbarProps {
  onNewEntity: () => void;
  onAddAttribute: () => void;
  onToggleRelationshipMode: () => void;
  onDeleteSelection: () => void;
  onToggleSnap: () => void;
  relationshipModeActive: boolean;
  snapToGrid: boolean;
  canAddAttribute: boolean;
  canDelete: boolean;
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

      <label className="chen-toolbar-toggle">
        <input type="checkbox" checked={props.snapToGrid} onChange={props.onToggleSnap} />
        {toolbar.snapToGrid}
      </label>
    </div>
  );
}
