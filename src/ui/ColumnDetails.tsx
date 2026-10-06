import { useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactElement } from 'react';
import { messages } from '../i18n/messages.en';
import { isIntegerType, SQL_TYPES, takesLength, takesPrecision } from '../model/column';
import { attributesOf } from '../model/queries';
import type { Attribute, ErDocument } from '../model/types';
import { useDocumentStore } from '../store/documentStore';
import { fromDraft, isSqlType, toDraft } from './columnDraft';
import type { ColumnDraft } from './columnDraft';

/**
 * Column details for the selected attribute, shown in the sidebar. They only
 * matter to Export SQL, so they live here rather than on the diagram.
 *
 * It is a small form, kept outside the sidebar's menu, because the menu's
 * arrow-key navigation would get in the way of its fields. The whole form is
 * applied at once, as one undo entry.
 */

const text = messages.column;

function nameOf(attribute: Attribute): string {
  return attribute.name.trim().length > 0 ? attribute.name.trim() : messages.element.unnamed;
}

interface FormProps {
  document: ErDocument;
  attribute: Attribute;
}

function ColumnForm({ document, attribute }: FormProps): ReactElement {
  const setAttributeColumn = useDocumentStore((state) => state.setAttributeColumn);
  const [draft, setDraft] = useState<ColumnDraft>(() => toDraft(attribute.column));
  const [error, setError] = useState<string | null>(null);
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
  };

  const type = draft.type === '' ? null : draft.type;
  const isKey = attribute.ownerKind === 'entity' && attribute.identifier !== 'none';

  return (
    <form onSubmit={onSubmit} noValidate>
      <label className="chen-field">
        <span>{text.type}</span>
        <select
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

export function ColumnDetails({ document, attribute }: FormProps): ReactElement {
  const reason = noColumnReason(document, attribute);

  return (
    <section
      className="chen-column-panel"
      aria-label={text.title(nameOf(attribute))}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        // The canvas listens on window; nothing typed in here is a shortcut.
        event.stopPropagation();
      }}
    >
      <span className="chen-menu-group-label">{text.label}</span>
      <p className="chen-panel-hint">{text.hint}</p>
      {reason === null ? (
        // Keyed by the stored column, so switching attributes, applying or
        // undoing starts a fresh draft from what is really stored.
        <ColumnForm
          key={`${attribute.id}:${JSON.stringify(attribute.column)}`}
          document={document}
          attribute={attribute}
        />
      ) : (
        <p>{reason}</p>
      )}
    </section>
  );
}
