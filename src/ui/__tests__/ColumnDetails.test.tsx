// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentMenu } from '../ComponentMenu';
import { messages } from '../../i18n/messages.en';
import { createColumnSpec } from '../../model/column';
import { resetIdGenerator, sequentialIdGenerator, setIdGenerator } from '../../model/ids';
import { createEmptyDocument } from '../../model/operations';
import { findAttribute } from '../../model/queries';
import type { ColumnSpec, Id } from '../../model/types';
import { useDocumentStore } from '../../store/documentStore';
import { useUiStore } from '../../store/uiStore';

const text = messages.column;
const store = (): ReturnType<typeof useDocumentStore.getState> => useDocumentStore.getState();

function columnOf(id: Id): ColumnSpec | undefined {
  return findAttribute(store().document.model, id)?.column;
}

interface Seed {
  book: Id;
  publisher: Id;
  isbn: Id;
  title: Id;
}

function seed(): Seed {
  const book = store().addEntityAt({ x: 0, y: 0 });
  const publisher = store().addEntityAt({ x: 400, y: 0 });
  store().rename(book, 'BOOK');
  store().rename(publisher, 'PUBLISHER');
  const isbn = store().addAttributeTo(book);
  store().rename(isbn, 'isbn');
  store().setAttributeIdentifier(isbn, 'key');
  const title = store().addAttributeTo(book);
  store().rename(title, 'title');
  useDocumentStore.temporal.getState().clear();
  return { book, publisher, isbn, title };
}

function openOn(elementId: Id): void {
  act(() => {
    useUiStore.getState().setSelectedIds([elementId]);
  });
}

function panel(): HTMLElement {
  return screen.getByRole('region');
}

describe('ColumnDetails', () => {
  beforeEach(() => {
    setIdGenerator(sequentialIdGenerator('c'));
    useDocumentStore.setState({ document: createEmptyDocument() });
    useDocumentStore.temporal.getState().clear();
    useUiStore.setState({
      selectedIds: [],
      relationshipMode: { active: false, firstEntityId: null },
      notice: null,
    });
    return () => {
      resetIdGenerator();
    };
  });

  it('shows only for an attribute, in the sidebar', () => {
    const { book, title } = seed();
    render(<ComponentMenu />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    openOn(book);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    openOn(title);
    expect(panel()).toHaveAccessibleName(text.title('title'));
    expect(screen.getByText(text.hint)).toBeInTheDocument();
  });

  it('applies the whole form as one undo entry', async () => {
    const { title } = seed();
    render(<ComponentMenu />);
    openOn(title);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: text.type }), 'VARCHAR');
    await userEvent.type(screen.getByRole('textbox', { name: text.length }), '200');
    await userEvent.click(screen.getByRole('checkbox', { name: text.notNull }));
    await userEvent.click(screen.getByRole('checkbox', { name: text.unique }));
    await userEvent.type(screen.getByRole('textbox', { name: text.defaultValue }), 'Untitled');
    await userEvent.click(screen.getByRole('button', { name: text.apply }));

    expect(columnOf(title)).toEqual({
      ...createColumnSpec(),
      type: 'VARCHAR',
      length: 200,
      notNull: true,
      unique: true,
      defaultValue: 'Untitled',
    });
    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(1);
    // The form now shows what was stored.
    expect(screen.getByRole('combobox', { name: text.type })).toHaveValue('VARCHAR');
  });

  it('shows only the fields the chosen type uses', async () => {
    const { title } = seed();
    render(<ComponentMenu />);
    openOn(title);
    const type = screen.getByRole('combobox', { name: text.type });

    expect(screen.queryByRole('textbox', { name: text.length })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: text.autoIncrement })).not.toBeInTheDocument();

    await userEvent.selectOptions(type, 'DECIMAL');
    expect(screen.getByRole('textbox', { name: text.precision })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: text.scale })).toBeInTheDocument();

    await userEvent.selectOptions(type, 'INT');
    expect(screen.queryByRole('textbox', { name: text.precision })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: text.autoIncrement })).toBeInTheDocument();
  });

  it('refuses a length that is not a whole number, and keeps the form open', async () => {
    const { title } = seed();
    render(<ComponentMenu />);
    openOn(title);

    await userEvent.selectOptions(screen.getByRole('combobox', { name: text.type }), 'CHAR');
    await userEvent.type(screen.getByRole('textbox', { name: text.length }), '2.5');
    await userEvent.click(screen.getByRole('button', { name: text.apply }));

    expect(screen.getByRole('alert')).toHaveTextContent(text.wholeNumber(text.length, 1));
    expect(columnOf(title)?.type).toBeNull();

    await userEvent.clear(screen.getByRole('textbox', { name: text.length }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a key as always NOT NULL', () => {
    const { isbn } = seed();
    render(<ComponentMenu />);
    openOn(isbn);
    const notNull = screen.getByRole('checkbox', { name: new RegExp(text.notNull) });
    expect(notNull).toBeChecked();
    expect(notNull).toBeDisabled();
    expect(screen.getByText(text.keyIsNotNull)).toBeInTheDocument();
  });

  it('offers the referenced entity only on a foreign key', async () => {
    const { title, publisher } = seed();
    render(<ComponentMenu />);
    openOn(title);
    expect(screen.queryByRole('combobox', { name: text.references })).not.toBeInTheDocument();
    expect(screen.getByText(text.referencesHint)).toBeInTheDocument();
    act(() => {
      store().setAttributeForeignKey(title, true);
    });

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: text.references }),
      'PUBLISHER',
    );
    await userEvent.click(screen.getByRole('button', { name: text.apply }));
    expect(columnOf(title)?.references).toBe(publisher);
  });

  it('explains why a derived or composite attribute has no column', () => {
    const { book } = seed();
    const age = store().addAttributeTo(book);
    store().setAttributeShape(age, 'derived');
    const name = store().addAttributeTo(book);
    store().setAttributeShape(name, 'composite');
    store().addAttributeTo(name);
    render(<ComponentMenu />);

    openOn(age);
    expect(panel()).toHaveTextContent(text.derived);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    openOn(name);
    expect(panel()).toHaveTextContent(text.composite);
  });

  it('drops an unapplied draft when another component is selected', async () => {
    const { book, title } = seed();
    render(<ComponentMenu />);

    openOn(title);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: text.type }), 'INT');
    openOn(book);
    openOn(title);

    expect(screen.getByRole('combobox', { name: text.type })).toHaveValue('');
    expect(columnOf(title)).toEqual(createColumnSpec());
  });

  it('keeps typing out of the canvas shortcuts', async () => {
    const { title } = seed();
    const seen: string[] = [];
    const listener = (event: KeyboardEvent): void => {
      seen.push(event.key);
    };
    globalThis.addEventListener('keydown', listener);
    render(<ComponentMenu />);
    openOn(title);

    await userEvent.type(screen.getByRole('textbox', { name: text.defaultValue }), 'e');
    globalThis.removeEventListener('keydown', listener);
    expect(seen).toEqual([]);
  });
});
