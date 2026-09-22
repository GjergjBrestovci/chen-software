import type { ReactElement } from 'react';
import { ContextMenu, MenuGroup, MenuItem } from './ContextMenu';
import { messages } from '../i18n/messages.en';
import { COLOR_PALETTE, hasColorOverride } from '../model/presentation';
import { findAttribute, findElementRef, findEntity, findRelationship } from '../model/queries';
import type { AttributeIdentifier, AttributeShape, ErDocument, Id } from '../model/types';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';

/**
 * The right-click menu over one component (SPEC.md §5).
 *
 * Every item dispatches a `documentStore` action, the same ones the Inspector
 * will use, so there is exactly one implementation of each edit. Options that
 * the model would refuse are disabled rather than offered and then rejected:
 * an attribute on a relationship cannot be a key, and a composite cannot
 * change shape while it still has parts.
 */

const SHAPES: { shape: AttributeShape; label: string }[] = [
  { shape: 'simple', label: messages.menu.simple },
  { shape: 'composite', label: messages.menu.composite },
  { shape: 'multivalued', label: messages.menu.multivalued },
  { shape: 'derived', label: messages.menu.derived },
];

const IDENTIFIERS: { identifier: AttributeIdentifier; label: string }[] = [
  { identifier: 'none', label: messages.menu.noKey },
  { identifier: 'key', label: messages.menu.primaryKey },
  { identifier: 'partial', label: messages.menu.partialKey },
];

interface SectionProps {
  document: ErDocument;
  elementId: Id;
  close: () => void;
}

function EntitySection({ document, elementId, close }: SectionProps): ReactElement | null {
  const setEntityKind = useDocumentStore((state) => state.setEntityKind);
  const entity = findEntity(document.model, elementId);
  if (!entity) {
    return null;
  }

  return (
    <MenuGroup label={messages.menu.entityKind}>
      {(['regular', 'weak'] as const).map((kind) => (
        <MenuItem
          key={kind}
          label={kind === 'regular' ? messages.menu.regular : messages.menu.weak}
          pressed={entity.kind === kind}
          onSelect={() => {
            setEntityKind(elementId, kind);
            close();
          }}
        />
      ))}
    </MenuGroup>
  );
}

function RelationshipSection({ document, elementId, close }: SectionProps): ReactElement | null {
  const setRelationshipKind = useDocumentStore((state) => state.setRelationshipKind);
  const relationship = findRelationship(document.model, elementId);
  if (!relationship) {
    return null;
  }

  return (
    <MenuGroup label={messages.menu.relationshipKind}>
      {(['regular', 'identifying'] as const).map((kind) => (
        <MenuItem
          key={kind}
          label={kind === 'regular' ? messages.menu.regular : messages.menu.identifying}
          pressed={relationship.kind === kind}
          onSelect={() => {
            setRelationshipKind(elementId, kind);
            close();
          }}
        />
      ))}
    </MenuGroup>
  );
}

function AttributeSection({ document, elementId, close }: SectionProps): ReactElement | null {
  const setAttributeShape = useDocumentStore((state) => state.setAttributeShape);
  const setAttributeIdentifier = useDocumentStore((state) => state.setAttributeIdentifier);
  const setAttributeForeignKey = useDocumentStore((state) => state.setAttributeForeignKey);
  const notify = useUiStore((state) => state.notify);

  const attribute = findAttribute(document.model, elementId);
  if (!attribute) {
    return null;
  }

  const hasParts = document.model.attributes.some((part) => part.ownerId === elementId);
  const canBeKey = attribute.ownerKind === 'entity';

  return (
    <>
      <MenuGroup label={messages.menu.attributeShape}>
        {SHAPES.map(({ shape, label }) => (
          <MenuItem
            key={shape}
            label={label}
            pressed={attribute.shape === shape}
            onSelect={() => {
              if (shape !== 'composite' && hasParts) {
                notify(messages.menu.compositeHasParts);
                return;
              }
              setAttributeShape(elementId, shape);
              close();
            }}
          />
        ))}
      </MenuGroup>

      <MenuGroup label={messages.menu.attributeKey}>
        {IDENTIFIERS.map(({ identifier, label }) => (
          <MenuItem
            key={identifier}
            label={label}
            pressed={attribute.identifier === identifier}
            onSelect={() => {
              if (identifier !== 'none' && !canBeKey) {
                notify(messages.menu.keysAreEntityOnly);
                return;
              }
              setAttributeIdentifier(elementId, identifier);
              close();
            }}
          />
        ))}
      </MenuGroup>

      <MenuGroup label={messages.menu.relational}>
        <MenuItem
          label={messages.menu.foreignKey}
          toggle
          pressed={attribute.foreignKey}
          onSelect={() => {
            setAttributeForeignKey(elementId, !attribute.foreignKey);
            close();
          }}
        />
      </MenuGroup>
    </>
  );
}

function ColourSection({ document, elementId, close }: SectionProps): ReactElement {
  const setElementColor = useDocumentStore((state) => state.setElementColor);
  const overridden = hasColorOverride(document.presentation, elementId);

  return (
    <MenuGroup label={messages.menu.colour}>
      <button
        type="button"
        data-menu-item
        role="menuitemradio"
        aria-checked={!overridden}
        aria-label={messages.menu.useThemeColour}
        title={messages.menu.useThemeColour}
        className="chen-swatch chen-swatch--theme"
        onClick={() => {
          setElementColor(elementId, null);
          close();
        }}
      />
      {COLOR_PALETTE.map((color, index) => (
        <button
          key={color}
          type="button"
          data-menu-item
          role="menuitemradio"
          aria-checked={document.presentation.colors[elementId] === color}
          aria-label={messages.menu.swatch(index + 1)}
          title={color}
          className="chen-swatch"
          style={{ background: color }}
          onClick={() => {
            setElementColor(elementId, color);
            close();
          }}
        />
      ))}
    </MenuGroup>
  );
}

export function ComponentMenu(): ReactElement | null {
  const document = useDocumentStore((state) => state.document);
  const remove = useDocumentStore((state) => state.remove);
  const contextMenu = useUiStore((state) => state.contextMenu);
  const closeContextMenu = useUiStore((state) => state.closeContextMenu);
  const startRenaming = useUiStore((state) => state.startRenaming);

  if (!contextMenu) {
    return null;
  }

  const element = findElementRef(document.model, contextMenu.elementId);
  if (!element) {
    return null;
  }

  const elementId = contextMenu.elementId;
  const sectionProps = { document, elementId, close: closeContextMenu };

  return (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      label={messages.menu.label}
      onClose={closeContextMenu}
    >
      <MenuGroup label={messages.menu.label}>
        <MenuItem
          label={messages.menu.rename}
          onSelect={() => {
            startRenaming(elementId);
            closeContextMenu();
          }}
        />
        <MenuItem
          label={messages.menu.delete}
          danger
          onSelect={() => {
            remove([elementId]);
            closeContextMenu();
          }}
        />
      </MenuGroup>

      {element.kind === 'entity' && <EntitySection {...sectionProps} />}
      {element.kind === 'relationship' && <RelationshipSection {...sectionProps} />}
      {element.kind === 'attribute' && <AttributeSection {...sectionProps} />}

      <ColourSection {...sectionProps} />
    </ContextMenu>
  );
}
