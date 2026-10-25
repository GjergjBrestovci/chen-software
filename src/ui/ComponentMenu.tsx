import type { ReactElement } from 'react';
import { ColumnDetails } from './ColumnDetails';
import { MenuGroup, MenuItem, MenuPanel } from './MenuPanel';
import { messages } from '../i18n/messages.en';
import { COLOR_PALETTE, hasColorOverride } from '../model/presentation';
import { MIN_SPECIALIZATION_SUBS } from '../model/operations';
import {
  canSpecialize,
  findAttribute,
  findElementRef,
  findEntity,
  findRelationship,
  findSpecialization,
} from '../model/queries';
import type {
  Attribute,
  AttributeIdentifier,
  AttributeShape,
  Entity,
  ErDocument,
  Id,
  Relationship,
  Specialization,
} from '../model/types';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';

/**
 * The sidebar for the selected components (SPEC.md §5). Selecting opens it;
 * clearing the selection closes it.
 *
 * With several selected, it offers only what applies to every one of them:
 * colour and delete always, a kind, shape or key only when all are the same
 * sort of component. An option shows as set only when it is set on all of
 * them, and one click changes all of them as a single undo entry.
 *
 * Every item dispatches a `documentStore` action, so there is exactly one
 * implementation of each edit. An edit the model would refuse for any one of
 * them is refused for all, with a notice saying why: an attribute on a
 * relationship cannot be a key, and a composite cannot change shape while it
 * still has parts.
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

interface SectionProps<T> {
  document: ErDocument;
  ids: Id[];
  items: T[];
}

/** True when every value is `expected`, so an option shows as set. */
function all<T>(values: readonly T[], expected: T): boolean {
  return values.length > 0 && values.every((value) => value === expected);
}

function EntitySection({ ids, items }: SectionProps<Entity>): ReactElement {
  const setEntityKind = useDocumentStore((state) => state.setEntityKind);

  return (
    <MenuGroup label={messages.menu.entityKind}>
      {(['regular', 'weak'] as const).map((kind) => (
        <MenuItem
          key={kind}
          label={kind === 'regular' ? messages.menu.regular : messages.menu.weak}
          pressed={all(
            items.map((entity) => entity.kind),
            kind,
          )}
          onSelect={() => {
            setEntityKind(ids, kind);
          }}
        />
      ))}
    </MenuGroup>
  );
}

/**
 * What a chosen selection can split into: every selected entity that could
 * legally be the superclass, by the model's own eligibility rules.
 */
function SpecializationFromSelection({
  document,
  ids,
  items,
}: SectionProps<Entity>): ReactElement | null {
  const addSpecializationFrom = useDocumentStore((state) => state.addSpecializationFrom);
  const notify = useUiStore((state) => state.notify);
  const setSelectedIds = useUiStore((state) => state.setSelectedIds);

  // A split is one superclass plus two subclasses: fewer selections cannot.
  if (items.length < MIN_SPECIALIZATION_SUBS + 1) {
    return null;
  }

  return (
    <MenuGroup label={messages.menu.specialization}>
      {items.map((entity) => {
        const others = ids.filter((id) => id !== entity.id);
        return (
          <MenuItem
            key={entity.id}
            label={entity.name.trim().length > 0 ? entity.name : messages.element.unnamed}
            onSelect={() => {
              if (!canSpecialize(document.model, entity.id, others)) {
                notify(messages.menu.specializationNotPossible);
                return;
              }
              // The new triangle takes the selection, so its own menu opens.
              setSelectedIds([addSpecializationFrom(entity.id, others)]);
            }}
          />
        );
      })}
    </MenuGroup>
  );
}

function SpecializationSection({
  document,
  ids,
  items,
}: SectionProps<Specialization>): ReactElement {
  const setSpecializationCoverage = useDocumentStore((state) => state.setSpecializationCoverage);
  const setSpecializationOverlap = useDocumentStore((state) => state.setSpecializationOverlap);
  const detachSpecializationSub = useDocumentStore((state) => state.detachSpecializationSub);
  const notify = useUiStore((state) => state.notify);

  const [onlyId] = ids;
  const single = ids.length === 1 ? onlyId : undefined;
  // Subclasses can only be listed for exactly one node.
  const node = single === undefined ? undefined : items[0];

  return (
    <>
      <MenuGroup label={messages.menu.coverage}>
        {(['partial', 'total'] as const).map((coverage) => (
          <MenuItem
            key={coverage}
            label={coverage === 'total' ? messages.menu.total : messages.menu.partial}
            pressed={all(
              items.map((spec) => spec.coverage),
              coverage,
            )}
            onSelect={() => {
              setSpecializationCoverage(ids, coverage);
            }}
          />
        ))}
      </MenuGroup>

      <MenuGroup label={messages.menu.overlap}>
        {(['disjoint', 'non-disjoint'] as const).map((overlap) => (
          <MenuItem
            key={overlap}
            label={overlap === 'disjoint' ? messages.menu.disjoint : messages.menu.nonDisjoint}
            pressed={all(
              items.map((spec) => spec.overlap),
              overlap,
            )}
            onSelect={() => {
              setSpecializationOverlap(ids, overlap);
            }}
          />
        ))}
      </MenuGroup>

      {node !== undefined && (
        <MenuGroup label={messages.menu.subclasses}>
          {node.subIds.map((subId) => {
            const sub = findEntity(document.model, subId);
            const label =
              sub !== undefined && sub.name.trim().length > 0 ? sub.name : messages.element.unnamed;
            return (
              <MenuItem
                key={subId}
                danger
                label={label}
                onSelect={() => {
                  if (node.subIds.length <= MIN_SPECIALIZATION_SUBS) {
                    notify(messages.menu.detachNeedsTwo);
                    return;
                  }
                  detachSpecializationSub(node.id, subId);
                }}
              />
            );
          })}
        </MenuGroup>
      )}
    </>
  );
}

function RelationshipSection({ ids, items }: SectionProps<Relationship>): ReactElement {
  const setRelationshipKind = useDocumentStore((state) => state.setRelationshipKind);

  return (
    <MenuGroup label={messages.menu.relationshipKind}>
      {(['regular', 'identifying'] as const).map((kind) => (
        <MenuItem
          key={kind}
          label={kind === 'regular' ? messages.menu.regular : messages.menu.identifying}
          pressed={all(
            items.map((relationship) => relationship.kind),
            kind,
          )}
          onSelect={() => {
            setRelationshipKind(ids, kind);
          }}
        />
      ))}
    </MenuGroup>
  );
}

function AttributeSection({ document, ids, items }: SectionProps<Attribute>): ReactElement {
  const setAttributeShape = useDocumentStore((state) => state.setAttributeShape);
  const setAttributeIdentifier = useDocumentStore((state) => state.setAttributeIdentifier);
  const setAttributeForeignKey = useDocumentStore((state) => state.setAttributeForeignKey);
  const notify = useUiStore((state) => state.notify);

  const anyHasParts = document.model.attributes.some((part) => ids.includes(part.ownerId));
  const allCanBeKeys = items.every((attribute) => attribute.ownerKind === 'entity');
  const allForeign = all(
    items.map((attribute) => attribute.foreignKey),
    true,
  );

  return (
    <>
      <MenuGroup label={messages.menu.attributeShape}>
        {SHAPES.map(({ shape, label }) => (
          <MenuItem
            key={shape}
            label={label}
            pressed={all(
              items.map((attribute) => attribute.shape),
              shape,
            )}
            onSelect={() => {
              if (shape !== 'composite' && anyHasParts) {
                notify(messages.menu.compositeHasParts);
                return;
              }
              setAttributeShape(ids, shape);
            }}
          />
        ))}
      </MenuGroup>

      <MenuGroup label={messages.menu.attributeKey}>
        {IDENTIFIERS.map(({ identifier, label }) => (
          <MenuItem
            key={identifier}
            label={label}
            pressed={all(
              items.map((attribute) => attribute.identifier),
              identifier,
            )}
            onSelect={() => {
              if (identifier !== 'none' && !allCanBeKeys) {
                notify(messages.menu.keysAreEntityOnly);
                return;
              }
              setAttributeIdentifier(ids, identifier);
            }}
          />
        ))}
      </MenuGroup>

      <MenuGroup label={messages.menu.relational}>
        <MenuItem
          label={messages.menu.foreignKey}
          toggle
          pressed={allForeign}
          onSelect={() => {
            setAttributeForeignKey(ids, !allForeign);
          }}
        />
      </MenuGroup>
    </>
  );
}

function ColourSection({ document, ids }: Omit<SectionProps<unknown>, 'items'>): ReactElement {
  const setElementColor = useDocumentStore((state) => state.setElementColor);
  const colors = ids.map((id) => document.presentation.colors[id]);

  return (
    <MenuGroup label={messages.menu.colour}>
      <button
        type="button"
        data-menu-item
        role="menuitemradio"
        aria-checked={ids.every((id) => !hasColorOverride(document.presentation, id))}
        aria-label={messages.menu.useThemeColour}
        title={messages.menu.useThemeColour}
        className="chen-swatch chen-swatch--theme"
        onClick={() => {
          setElementColor(ids, null);
        }}
      />
      {COLOR_PALETTE.map((color, index) => (
        <button
          key={color}
          type="button"
          data-menu-item
          role="menuitemradio"
          aria-checked={all(colors, color)}
          aria-label={messages.menu.swatch(index + 1)}
          title={color}
          className="chen-swatch"
          style={{ background: color }}
          onClick={() => {
            setElementColor(ids, color);
          }}
        />
      ))}
    </MenuGroup>
  );
}

/** `items` when `find` finds every id, otherwise `null`: the selection is mixed. */
function allOf<T>(ids: readonly Id[], find: (id: Id) => T | undefined): T[] | null {
  const items: T[] = [];
  for (const id of ids) {
    const item = find(id);
    if (item === undefined) {
      return null;
    }
    items.push(item);
  }
  return items;
}

export function ComponentMenu(): ReactElement | null {
  const document = useDocumentStore((state) => state.document);
  const remove = useDocumentStore((state) => state.remove);
  const selectedIds = useUiStore((state) => state.selectedIds);
  const setSelectedIds = useUiStore((state) => state.setSelectedIds);
  const startRenaming = useUiStore((state) => state.startRenaming);
  const linking = useUiStore((state) => state.relationshipMode.active);

  const { model } = document;
  // Undo can remove a selected component before the selection catches up.
  const ids = selectedIds.filter((id) => findElementRef(model, id) !== undefined);
  // Hidden while picking entities for a relationship, so it never covers one.
  if (linking || ids.length === 0) {
    return null;
  }

  const entities = allOf(ids, (id) => findEntity(model, id));
  const relationships = allOf(ids, (id) => findRelationship(model, id));
  const attributes = allOf(ids, (id) => findAttribute(model, id));
  const specializations = allOf(ids, (id) => findSpecialization(model, id));
  const [onlyId] = ids;
  const single = ids.length === 1 ? onlyId : undefined;
  const singleAttribute = single === undefined ? undefined : attributes?.[0];
  const title =
    single === undefined ? messages.menu.selectionCount(ids.length) : messages.menu.label;

  return (
    <aside className="chen-sidebar" aria-label={messages.menu.label}>
      <MenuPanel label={messages.menu.label}>
        <MenuGroup label={title}>
          {single !== undefined && (
            <MenuItem
              label={messages.menu.rename}
              onSelect={() => {
                startRenaming(single);
              }}
            />
          )}
          <MenuItem
            label={messages.menu.delete}
            danger
            onSelect={() => {
              remove(ids);
              setSelectedIds([]);
            }}
          />
        </MenuGroup>

        {entities && <EntitySection document={document} ids={ids} items={entities} />}
        {entities && <SpecializationFromSelection document={document} ids={ids} items={entities} />}
        {relationships && (
          <RelationshipSection document={document} ids={ids} items={relationships} />
        )}
        {attributes && <AttributeSection document={document} ids={ids} items={attributes} />}
        {specializations && (
          <SpecializationSection document={document} ids={ids} items={specializations} />
        )}

        <ColourSection document={document} ids={ids} />
      </MenuPanel>

      {singleAttribute && <ColumnDetails document={document} attribute={singleAttribute} />}
    </aside>
  );
}
