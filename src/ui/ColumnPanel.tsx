import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactElement } from 'react';
import { messages } from '../i18n/messages.en';
import { isIntegerType, SQL_TYPES, takesLength, takesPrecision } from '../model/column';
import { attributesOf, findAttribute } from '../model/queries';
import type { Attribute, ErDocument } from '../model/types';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { fromDraft, isSqlType, toDraft } from './columnDraft';
import type { ColumnDraft } from './columnDraft';
import { clampToViewport } from './viewport';

/**
 * Column details for one attribute, opened from its right-click menu. They
 * only matter to Export SQL, so they live here rather than on the diagram.
 *
 * It is a small form rather than more menu items because it has text and
 * number fields, which the menu's arrow-key navigation would get in the way
 * of. The whole form is applied at once, as one undo entry.
 */

const text = messages.column;

function nameOf(attribute: Attribute): string {
  return attribute.name.trim().length > 0 ? attribute.name.trim() : messages.element.unnamed;
}

interface FormProps {
  document: ErDocument;
  attribute: Attribute;
  close: () => void;
}

function ColumnForm({ document, attribute, close }: FormProps): ReactElement {
  const setAttributeColumn = useDocumentStore((state) => state.setAttributeColumn);
  const [draft, setDraft] = useState<ColumnDraft>(() => toDraft(attribute.column));
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const change = (changes: Partial<ColumnDraft>): void => {
    setDraft((current) => ({ ...current, ...changes }));
    setError(null);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const outcome = fromDraft(draft, attribute.column);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setAttributeColumn(attribute.id, outcome.spec);
    close();
  };

  const type = draft.type === '' ? null : draft.type;
  const isKey = attribute.ownerKind === 'entity' && attribute.identifier !== 'none';

  return (
    <form onSubmit={onSubmit} noValidate>
      <label className="chen-field">
        <span>{text.type}</span>
        <select
          ref={firstFieldRef}
          value={draft.type}
          onChange={(event) => {
            change({ type: isSqlType(event.target.value) ? event.target.value : '' });
          }}
        >
          <option value="">{text.notSet}</option>
          {SQL_TYPES.map((sqlType) => (
            <option key={sqlType} value={sqlType}>
              {sqlType}
            </option>
          ))}
        </select>
      </label>

      {type !== null && takesLength(type) && (
        <label className="chen-field">
          <span>{text.length}</span>
          <input
            inputMode="numeric"
            value={draft.length}
            onChange={(event) => {
              change({ length: event.target.value });
            }}
          />
        </label>
      )}

      {type !== null && takesPrecision(type) && (
        <div className="chen-field-row">
          <label className="chen-field">
            <span>{text.precision}</span>
            <input
              inputMode="numeric"
              value={draft.precision}
              onChange={(event) => {
                change({ precision: event.target.value });
              }}
            />
          </label>
          <label className="chen-field">
            <span>{text.scale}</span>
            <input
              inputMode="numeric"
              value={draft.scale}
              onChange={(event) => {
                change({ scale: event.target.value });
              }}
            />
          </label>
        </div>
      )}

      <label className="chen-check">
        <input
          type="checkbox"
          checked={isKey || draft.notNull}
          disabled={isKey}
          onChange={(event) => {
            change({ notNull: event.target.checked });
          }}
        />
        <span>
          {text.notNull}
          {isKey && <small>{text.keyIsNotNull}</small>}
        </span>
      </label>

      <label className="chen-check">
        <input
          type="checkbox"
          checked={draft.unique}
          onChange={(event) => {
            change({ unique: event.target.checked });
          }}
        />
        {text.unique}
      </label>

      {type !== null && isIntegerType(type) && (
        <label className="chen-check">
          <input
            type="checkbox"
            checked={draft.autoIncrement}
            onChange={(event) => {
              change({ autoIncrement: event.target.checked });
            }}
          />
          {text.autoIncrement}
        </label>
      )}

      <label className="chen-field">
        <span>{text.defaultValue}</span>
        <input
          value={draft.defaultValue}
          placeholder={text.defaultPlaceholder}
          onChange={(event) => {
            change({ defaultValue: event.target.value });
          }}
        />
      </label>

      {attribute.foreignKey ? (
        <label className="chen-field">
          <span>{text.references}</span>
          <select
            value={draft.references}
            onChange={(event) => {
              change({ references: event.target.value });
            }}
          >
            <option value="">{text.notSet}</option>
            {document.model.entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name.trim().length > 0 ? entity.name : messages.element.unnamed}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="chen-panel-hint">{text.referencesHint}</p>
      )}

      {error !== null && (
        <p className="chen-panel-error" role="alert">
          {error}
        </p>
      )}

      <div className="chen-dialog-actions">
        <button type="button" onClick={close}>
          {messages.dialog.cancel}
        </button>
        <button type="submit" className="chen-dialog-primary">
          {text.apply}
        </button>
      </div>
    </form>
  );
}

/** Why an attribute has no column of its own, for the two that do not. */
function noColumnReason(document: ErDocument, attribute: Attribute): string | null {
  if (attribute.shape === 'derived') return text.derived;
  if (attribute.shape === 'composite' && attributesOf(document.model, attribute.id).length > 0) {
    return text.composite;
  }
  return null;
}

export function ColumnPanel(): ReactElement | null {
  const document = useDocumentStore((state) => state.document);
  const panel = useUiStore((state) => state.columnPanel);
  const close = useUiStore((state) => state.closeColumnPanel);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panel && panelRef.current) {
      clampToViewport(panelRef.current, panel.x, panel.y);
    }
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) {
        return;
      }
      close();
    };
    // Capture, so the canvas underneath never also acts on the click.
    globalThis.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      globalThis.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [panel, close]);

  const attribute = panel ? findAttribute(document.model, panel.elementId) : undefined;
  if (!panel || !attribute) {
    return null;
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // The canvas listens on window; nothing typed in here is a shortcut.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const reason = noColumnReason(document, attribute);
  const title = text.title(nameOf(attribute));

  return (
    <div
      ref={panelRef}
      className="chen-context-menu chen-column-panel"
      role="dialog"
      aria-label={title}
      onKeyDown={onKeyDown}
    >
      <h2>{title}</h2>
      <p className="chen-panel-hint">{text.hint}</p>
      {reason === null ? (
        // Keyed by attribute, so switching attributes starts a fresh draft.
        <ColumnForm key={attribute.id} document={document} attribute={attribute} close={close} />
      ) : (
        <>
          <p>{reason}</p>
          <div className="chen-dialog-actions">
            <button type="button" onClick={close}>
              {messages.dialog.close}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
