// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TitleField } from '../TitleField';
import { createEmptyDocument, setTitle } from '../../model/operations';
import { useDocumentStore } from '../../store/documentStore';

const title = (): string => useDocumentStore.getState().document.title;
const field = (): HTMLInputElement => screen.getByRole('textbox', { name: 'Diagram title' });

describe('TitleField', () => {
  beforeEach(() => {
    useDocumentStore.setState({ document: setTitle(createEmptyDocument(), 'Bookstore') });
    useDocumentStore.temporal.getState().clear();
  });

  it('shows the current title', () => {
    render(<TitleField />);
    expect(field().value).toBe('Bookstore');
  });

  it('renames the diagram on Enter', async () => {
    const user = userEvent.setup();
    render(<TitleField />);

    await user.clear(field());
    await user.type(field(), 'University{Enter}');

    expect(title()).toBe('University');
  });

  it('renames the diagram when the field loses focus', async () => {
    const user = userEvent.setup();
    render(<TitleField />);

    await user.clear(field());
    await user.type(field(), 'University');
    await user.tab();

    expect(title()).toBe('University');
  });

  it('trims surrounding spaces', async () => {
    const user = userEvent.setup();
    render(<TitleField />);

    await user.clear(field());
    await user.type(field(), '  University  {Enter}');

    expect(title()).toBe('University');
  });

  it('puts the old title back on Escape', async () => {
    const user = userEvent.setup();
    render(<TitleField />);

    await user.clear(field());
    await user.type(field(), 'Oops{Escape}');

    expect(title()).toBe('Bookstore');
    expect(field().value).toBe('Bookstore');
  });

  it('records a rename as one undo step, and nothing when the title is unchanged', async () => {
    const user = userEvent.setup();
    render(<TitleField />);

    await user.click(field());
    await user.tab();
    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(0);

    await user.clear(field());
    await user.type(field(), 'University{Enter}');
    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(1);
  });

  it('follows the title when it changes elsewhere, such as undo or Open', () => {
    render(<TitleField />);
    act(() => {
      useDocumentStore.getState().setTitle('Opened file');
    });
    expect(field().value).toBe('Opened file');
  });

  it('keeps typing from reaching the canvas shortcuts', async () => {
    const user = userEvent.setup();
    const onWindowKeyDown = vi.fn();
    window.addEventListener('keydown', onWindowKeyDown);
    render(<TitleField />);

    await user.type(field(), 'era');

    window.removeEventListener('keydown', onWindowKeyDown);
    expect(onWindowKeyDown).not.toHaveBeenCalled();
  });
});
