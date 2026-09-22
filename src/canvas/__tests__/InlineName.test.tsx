// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineName } from '../nodes/InlineName';

function setup(value = 'BOOK') {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(<InlineName value={value} fontSize={14} onCommit={onCommit} onCancel={onCancel} />);
  return { onCommit, onCancel, input: screen.getByRole('textbox') };
}

describe('InlineName', () => {
  it('starts from the current name, focused and selected', () => {
    const { input } = setup();
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).value).toBe('BOOK');
  });

  it('confirms with Enter', async () => {
    const user = userEvent.setup();
    const { onCommit, onCancel } = setup('');
    await user.keyboard('AUTHOR{Enter}');
    expect(onCommit).toHaveBeenCalledWith('AUTHOR');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels with Escape, without committing', async () => {
    const user = userEvent.setup();
    const { onCommit, onCancel } = setup('BOOK');
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('allows an empty name, which the validator flags rather than the editor', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup('BOOK');
    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledWith('');
  });

  it('commits when focus moves away', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup('BOOK');
    await user.keyboard('S');
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith('S');
  });

  it('keeps typing from reaching the canvas shortcuts', async () => {
    const user = userEvent.setup();
    const onWindowKeyDown = vi.fn();
    window.addEventListener('keydown', onWindowKeyDown);
    setup('');
    await user.keyboard('ear');
    window.removeEventListener('keydown', onWindowKeyDown);
    expect(onWindowKeyDown).not.toHaveBeenCalled();
  });
});
