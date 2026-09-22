// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
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
    useUiStore.getState().openContextMenu({ elementId, x: 120, y: 80 });
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
      contextMenu: null,
      notice: null,
    });
    return () => {
      resetIdGenerator();
    };
  });

  it('shows nothing until it is opened on a component', () => {
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
    expect(useUiStore.getState().contextMenu).toBeNull();
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
    expect(useUiStore.getState().contextMenu).toBeNull();
  });

  it('deletes the component, cascading as usual', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(findEntity(store().document.model, entity)).toBeUndefined();
    expect(store().document.model.relationships).toEqual([]);
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

  it('closes on Escape without changing anything', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(useUiStore.getState().contextMenu).toBeNull();
    });
    expect(findEntity(store().document.model, entity)?.kind).toBe('regular');
  });

  it('closes when the student clicks away', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    await user.click(document.body);

    await waitFor(() => {
      expect(useUiStore.getState().contextMenu).toBeNull();
    });
  });

  it('focuses the first item and moves with the arrow keys', async () => {
    const user = userEvent.setup();
    const { entity } = seed();
    openOn(entity);
    renderMenu();

    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    await waitFor(() => {
      expect(rename).toHaveFocus();
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
    useUiStore.setState({ contextMenu: null, notice: null, renamingId: null, selectedIds: [] });
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
