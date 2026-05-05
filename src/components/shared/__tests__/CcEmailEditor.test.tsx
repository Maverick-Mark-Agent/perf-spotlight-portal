import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { CcEmailEditor } from '../CcEmailEditor';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const Harness = ({
  initial = [] as string[],
  suggestions = [] as string[],
}: {
  initial?: string[];
  suggestions?: string[];
}) => {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <div>
      <CcEmailEditor value={value} onChange={setValue} suggestions={suggestions} />
      <div data-testid="cc-state">{value.join(',')}</div>
    </div>
  );
};

const stateText = () => screen.getByTestId('cc-state').textContent || '';

const openPopover = () =>
  fireEvent.click(screen.getByRole('button', { name: /Add CC/i }));

describe('CcEmailEditor', () => {
  it('renders initial value as chips', () => {
    render(<Harness initial={['a@example.com', 'b@example.com']} />);
    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    expect(screen.getByText('b@example.com')).toBeInTheDocument();
    expect(screen.getByText('CC Recipients (2)')).toBeInTheDocument();
  });

  it('shows the empty placeholder when value is empty', () => {
    render(<Harness initial={[]} />);
    expect(screen.getByText('No CC recipients')).toBeInTheDocument();
    expect(screen.getByText('CC Recipients (0)')).toBeInTheDocument();
  });

  it('removes a chip when its X button is clicked', () => {
    render(<Harness initial={['a@example.com', 'b@example.com']} />);
    fireEvent.click(screen.getByLabelText('Remove a@example.com'));
    expect(stateText()).toBe('b@example.com');
  });

  it('adds a free-text email via Enter', async () => {
    render(<Harness initial={[]} />);
    openPopover();
    const input = await screen.findByPlaceholderText(/Search or type email/i);
    fireEvent.change(input, { target: { value: 'new@example.com' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(stateText()).toBe('new@example.com'));
  });

  it('does not add an invalid email', async () => {
    render(<Harness initial={[]} />);
    openPopover();
    const input = await screen.findByPlaceholderText(/Search or type email/i);
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    // Give any state update a chance to flush; result must remain empty.
    await new Promise((r) => setTimeout(r, 0));
    expect(stateText()).toBe('');
  });

  it('de-dupes when adding an email already in value', async () => {
    render(<Harness initial={['dup@example.com']} suggestions={[]} />);
    openPopover();
    const input = await screen.findByPlaceholderText(/Search or type email/i);
    fireEvent.change(input, { target: { value: 'dup@example.com' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await new Promise((r) => setTimeout(r, 0));
    expect(stateText()).toBe('dup@example.com');
  });

  it('normalizes added emails to lowercase + trimmed', async () => {
    render(<Harness initial={[]} />);
    openPopover();
    const input = await screen.findByPlaceholderText(/Search or type email/i);
    fireEvent.change(input, { target: { value: '  Mixed@Case.COM  ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(stateText()).toBe('mixed@case.com'));
  });
});
