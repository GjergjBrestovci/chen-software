// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentMenu } from '../ComponentMenu';
import { Notice } from '../Notice';
import { resetIdGenerator, sequentialIdGenerator, setIdGenerator } from '../../model/ids';
import { createEmptyDocument } from '../../model/operations';
import { colorFor, hasColorOverride } from '../../model/presentation';
import { findAttribute, findEntity, findRelationship } from '../../model/queries';
import type { Id } from '../../model/types';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';

const store = (): ReturnType<typeof useDocumentStore.getState> => useDocumentStore.getState();

interface Seed {
  entity: Id;
  relationship: Id;
  attribute: Id;
  relationshipAttribute: Id;
}

/** BOOK ─ writes ─ AUTHOR, with an attribute on each. */
function seed(): Seed {
  const entity = store().addEntityAt({ x: 0, y: 0 });
  const other = store().addEntityAt({ x: 400, y: 0 });
  store().rename(entity, 'BOOK');
  store().rename(other, 'AUTHOR');
  const relationship = store().addRelationshipBetween([entity, other], { x: 200, y: 0 });
  const attribute = store().addAttributeTo(entity);
  const relationshipAttribute = store().addAttributeTo(relationship);
  return { entity, relationship, attribute, relationshipAttribute };
}

function openOn(elementId: Id): void {
  act(() => {
    useUiStore.getState().setSelectedIds([elementId]);
  });
}

function renderMenu() {
  return render(
    <>
      <ComponentMenu />
      <Notice />
    </>,
  );
}

describe('ComponentMenu', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('m'));
    useDocumentStore.setState({ document: createEmptyDocument() });
    useDocumentStore.temporal.getState().clear();
    useUiStore.setState({
      selectedIds: [],
      renamingId: null,
      relationshipMode: { active: false, firstEntityId: null },
      notice: null,
    });
    return () => {
      resetIdGenerator();
    };
  });

  it('shows nothing until a component is selected', () => {
    seed();
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows nothing for a component that no longer exists', () => {
    seed();
    openOn('ghost');
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers weak and regular for an entity', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: 'Weak' }));

    expect(findEntity(store().document.model, entity)?.kind).toBe('weak');
    // The sidebar stays open so the next edit is one click away.
    expect(screen.getByRole('menuitemradio', { name: 'Weak' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('offers identifying for a relationship', async () => {
    const user = userEvent.setup();
    const { relationship } = seed();
    openOn(relationship);
    renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: 'Identifying' }));

    expect(findRelationship(store().document.model, relationship)?.kind).toBe('identifying');
  });

  it('does not offer entity kinds on a relationship', () => {
    const { relationship } = seed();
    openOn(relationship);
    renderMenu();
    expect(screen.queryByRole('menuitemradio', { name: 'Weak' })).not.toBeInTheDocument();
  });

  it('marks an attribute as a primary key', async () => {
    const user = userEvent.setup();
    const { attribute } = seed();
    openOn(attribute);
    renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: 'Primary key' }));

    expect(findAttribute(store().document.model, attribute)?.identifier).toBe('key');
  });

  it('marks an attribute as a partial key', async () => {
    const user = userEvent.setup();
    const { attribute } = seed();
    openOn(attribute);
    renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: 'Partial key' }));

    expect(findAttribute(store().document.model, attribute)?.identifier).toBe('partial');
  });

  it('toggles a foreign key, independently of the key setting', async () => {
    const user = userEvent.setup();
    const { attribute } = seed();
    openOn(attribute);
    renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: 'Primary key' }));
    openOn(attribute);
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Foreign key' }));

    const marked = findAttribute(store().document.model, attribute);
    expect(marked?.identifier).toBe('key');
    expect(marked?.foreignKey).toBe(true);
  });

  it('explains why a relationship attribute cannot be a key, and changes nothing', async () => {
    const user = userEvent.setup();
    const { relationshipAttribute } = seed();
    openOn(relationshipAttribute);
    renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: 'Primary key' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/only an entity attribute/i);
    expect(findAttribute(store().document.model, relationshipAttribute)?.identifier).toBe('none');
  });

  it('changes an attribute shape', async () => {
    const user = userEvent.setup();
    const { attribute } = seed();
    openOn(attribute);
    renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: 'Multivalued' }));

    expect(findAttribute(store().document.model, attribute)?.shape).toBe('multivalued');
  });

  it('refuses to drop the composite shape while parts remain, and says why', async () => {
    const user = userEvent.setup();
    const { attribute } = seed();
    act(() => {
      store().setAttributeShape(attribute, 'composite');
      store().addAttributeTo(attribute);
    });

    openOn(attribute);
    renderMenu();
    await user.click(screen.getByRole('menuitemradio', { name: 'Simple' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/delete its parts/i);
    expect(findAttribute(store().document.model, attribute)?.shape).toBe('composite');
  });

  it('sets a colour and clears it again', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    await user.click(screen.getByRole('menuitemradio', { name: 'Colour 6' }));
    expect(colorFor(store().document.presentation, entity, 'entity')).toBe('#2563eb');

    openOn(entity);
    await user.click(screen.getByRole('menuitemradio', { name: 'Theme colour' }));
    expect(hasColorOverride(store().document.presentation, entity)).toBe(false);
  });

  it('starts a rename', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(useUiStore.getState().renamingId).toBe(entity);
  });

  it('deletes the component, cascading as usual', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(findEntity(store().document.model, entity)).toBeUndefined();
    expect(store().document.model.relationships).toEqual([]);
    expect(useUiStore.getState().selectedIds).toEqual([]);
  });

  it('records one undo entry per menu action', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    const before = useDocumentStore.temporal.getState().pastStates.length;
    await user.click(screen.getByRole('menuitemradio', { name: 'Weak' }));

    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(before + 1);
  });

  it('closes when the selection is cleared', () => {
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    act(() => {
      useUiStore.getState().setSelectedIds([]);
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  describe('with several components selected', () => {
    function select(...ids: Id[]): void {
      act(() => {
        useUiStore.getState().setSelectedIds(ids);
      });
    }

    it('offers colour and delete for a mixed selection, but no kinds or keys', () => {
      const { entity, attribute } = seed();
      select(entity, attribute);
      renderMenu();

      expect(screen.getByText('2 components selected')).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: 'Colour 6' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitemradio', { name: 'Weak' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitemradio', { name: 'Primary key' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });

    it('colours every selected component as one undo entry', async () => {
      const user = userEvent.setup();
      const { entity, relationship, attribute } = seed();
      select(entity, relationship, attribute);
      renderMenu();

      const before = useDocumentStore.temporal.getState().pastStates.length;
      await user.click(screen.getByRole('menuitemradio', { name: 'Colour 6' }));

      for (const id of [entity, relationship, attribute]) {
        expect(store().document.presentation.colors[id]).toBe('#2563eb');
      }
      expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(before + 1);
      expect(screen.getByRole('menuitemradio', { name: 'Colour 6' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('makes several entity attributes primary keys at once', async () => {
      const user = userEvent.setup();
      const { entity, attribute } = seed();
      const second = store().addAttributeTo(entity);
      select(attribute, second);
      renderMenu();

      await user.click(screen.getByRole('menuitemradio', { name: 'Primary key' }));

      expect(findAttribute(store().document.model, attribute)?.identifier).toBe('key');
      expect(findAttribute(store().document.model, second)?.identifier).toBe('key');
    });

    it('refuses a key for all when one attribute sits on a relationship', async () => {
      const user = userEvent.setup();
      const { attribute, relationshipAttribute } = seed();
      select(attribute, relationshipAttribute);
      renderMenu();

      await user.click(screen.getByRole('menuitemradio', { name: 'Primary key' }));

      expect(await screen.findByRole('status')).toHaveTextContent(/only an entity attribute/i);
      expect(findAttribute(store().document.model, attribute)?.identifier).toBe('none');
    });

    it('shows an option as set only when it is set on all of them', () => {
      const { entity } = seed();
      const other = store().addEntityAt({ x: 0, y: 300 });
      act(() => {
        store().setEntityKind(entity, 'weak');
      });
      select(entity, other);
      renderMenu();

      expect(screen.getByRole('menuitemradio', { name: 'Weak' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.getByRole('menuitemradio', { name: 'Regular' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    it('deletes every selected component', async () => {
      const user = userEvent.setup();
      const { entity, attribute, relationshipAttribute } = seed();
      select(attribute, relationshipAttribute);
      renderMenu();

      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

      expect(store().document.model.attributes).toEqual([]);
      expect(findEntity(store().document.model, entity)).toBeDefined();
      expect(useUiStore.getState().selectedIds).toEqual([]);
    });
  });

  it('moves between items with the arrow keys', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    act(() => {
      rename.focus();
    });

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(rename).toHaveFocus();
  });

  it('shows which option is currently set', () => {
    const { entity } = seed();
    act(() => {
      store().setEntityKind(entity, 'weak');
    });
    openOn(entity);
    renderMenu();

    expect(screen.getByRole('menuitemradio', { name: 'Weak' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Regular' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});

describe('ComponentMenu foreign key toggle', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('f'));
    useDocumentStore.setState({ document: createEmptyDocument() });
    useDocumentStore.temporal.getState().clear();
    useUiStore.setState({ notice: null, renamingId: null, selectedIds: [] });
    return () => {
      resetIdGenerator();
    };
  });

  it('reads as an on/off toggle, not a statement of fact', async () => {
    const user = userEvent.setup();
    const { attribute } = seed();
    openOn(attribute);
    renderMenu();

    const toggle = screen.getByRole('menuitemcheckbox', { name: 'Foreign key' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);
    expect(findAttribute(store().document.model, attribute)?.foreignKey).toBe(true);

    openOn(attribute);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Foreign key' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('turns a foreign key back off', async () => {
    const user = userEvent.setup();
    const { attribute } = seed();
    act(() => {
      store().setAttributeForeignKey(attribute, true);
    });

    openOn(attribute);
    renderMenu();
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Foreign key' }));

    expect(findAttribute(store().document.model, attribute)?.foreignKey).toBe(false);
  });
});
