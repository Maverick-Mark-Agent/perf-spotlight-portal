import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import { AutoReplyReviewCard } from '../AutoReplyReviewCard';
import type { AutoReplyQueueRow } from '@/hooks/useAutoReplyQueue';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useWorkspaceCcSuggestions', () => ({
  useWorkspaceCcSuggestions: () => ({ suggestions: [], loading: false, error: null }),
}));

const mockProducers: { user_id: string; full_name: string; email: string }[] = [
  { user_id: 'prod-1', full_name: 'Producer One', email: 'p1@example.com' },
  { user_id: 'prod-2', full_name: 'Producer Two', email: 'p2@example.com' },
];

vi.mock('@/hooks/useWorkspaceProducers', () => ({
  useWorkspaceProducers: () => ({ producers: mockProducers, loading: false, error: null }),
}));

const mockSession = {
  user: { id: 'reviewer-uuid' },
  access_token: 'fake-token',
};

const queueUpdateChain = {
  eq: vi.fn().mockResolvedValue({ error: null }),
};
const leadsUpdateChain = {
  eq: vi.fn().mockReturnThis(),
};
const fromMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: mockSession } })),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const baseLead = {
  id: 1,
  reply_uuid: 'reply-uuid-123',
  workspace_name: 'Test Agency',
  lead_email: 'lead@example.com',
  first_name: 'Lead',
  last_name: 'Person',
  company: 'Acme',
  title: 'Owner',
  reply_text: 'Inbound message body.',
  bison_conversation_url: null,
  phone: null,
};

const baseRow: AutoReplyQueueRow = {
  id: 'queue-row-id',
  reply_uuid: 'reply-uuid-123',
  workspace_name: 'Test Agency',
  status: 'review_required',
  generated_reply_text: 'Drafted reply text.',
  cc_emails: ['cc1@example.com', 'cc2@example.com'],
  audit_score: 90,
  audit_reasoning: 'looks good',
  audit_issues: [],
  audit_model: 'auditor-v1',
  generation_model: 'gen-v1',
  suggested_feedback: null,
  // @ts-expect-error joined lead may not be in the type strictly
  lead: baseLead,
  updated_at: new Date().toISOString(),
} as AutoReplyQueueRow;

const buildFetchMock = (ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ success: ok }),
  });

beforeEach(() => {
  fromMock.mockReset();
  queueUpdateChain.eq.mockClear();
  queueUpdateChain.eq.mockResolvedValue({ error: null });
  leadsUpdateChain.eq.mockClear();
  leadsUpdateChain.eq.mockReturnThis();
  updateMock.mockReset();

  fromMock.mockImplementation((table: string) => {
    if (table === 'auto_reply_queue') {
      return {
        update: vi.fn(() => queueUpdateChain),
      };
    }
    if (table === 'client_leads') {
      const finalEq = vi.fn().mockResolvedValue({ error: null });
      return {
        update: (payload: unknown) => {
          updateMock(payload);
          return {
            eq: vi.fn(() => ({
              eq: finalEq,
            })),
          };
        },
      };
    }
    throw new Error(`unexpected from(${table})`);
  });
});

describe('AutoReplyReviewCard', () => {
  it('renders editable CC chips reflecting row.cc_emails', () => {
    const patchRow = vi.fn();
    render(<AutoReplyReviewCard row={baseRow} patchRow={patchRow} />);
    expect(screen.getByText('cc1@example.com')).toBeInTheDocument();
    expect(screen.getByText('cc2@example.com')).toBeInTheDocument();
    expect(screen.getByText(/CC Recipients \(2\)/)).toBeInTheDocument();
  });

  it('sends edited CCs (not the original row.cc_emails) to the edge function', async () => {
    const fetchSpy = buildFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    const patchRow = vi.fn();
    render(<AutoReplyReviewCard row={baseRow} patchRow={patchRow} />);

    // Remove cc1 by clicking its X button.
    fireEvent.click(screen.getByLabelText('Remove cc1@example.com'));

    // Click Approve & Send.
    fireEvent.click(screen.getByRole('button', { name: /Approve.*Send/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const sendCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes('send-reply-via-bison'),
    );
    expect(sendCall).toBeDefined();
    const body = JSON.parse(String(sendCall![1].body));
    expect(body.cc_emails).toEqual(['cc2@example.com']);
    expect(body.reply_uuid).toBe('reply-uuid-123');

    vi.unstubAllGlobals();
  });

  it('after successful send, transitions to assigning view', async () => {
    const fetchSpy = buildFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    const patchRow = vi.fn();
    render(<AutoReplyReviewCard row={baseRow} patchRow={patchRow} />);
    fireEvent.click(screen.getByRole('button', { name: /Approve.*Send/i }));

    await waitFor(() =>
      expect(screen.getByText(/Reply sent to Lead Person/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Assign this lead to a producer/i)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('Skip on assigning step calls removeRow and does NOT update client_leads', async () => {
    const fetchSpy = buildFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    const patchRow = vi.fn();
    const removeRow = vi.fn();
    render(<AutoReplyReviewCard row={baseRow} patchRow={patchRow} removeRow={removeRow} />);
    fireEvent.click(screen.getByRole('button', { name: /Approve.*Send/i }));

    await waitFor(() => screen.getByText(/Reply sent to Lead Person/i));

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(removeRow).toHaveBeenCalledWith('queue-row-id');
    expect(updateMock).not.toHaveBeenCalled(); // no client_leads UPDATE
    vi.unstubAllGlobals();
  });

  it('Assign & Done writes assigned_to_* fields to client_leads via the right composite key', async () => {
    const fetchSpy = buildFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    const patchRow = vi.fn();
    const removeRow = vi.fn();
    render(<AutoReplyReviewCard row={baseRow} patchRow={patchRow} removeRow={removeRow} />);
    fireEvent.click(screen.getByRole('button', { name: /Approve.*Send/i }));

    await waitFor(() => screen.getByText(/Reply sent to Lead Person/i));

    // Open the producer Select and pick the first producer.
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getByText('Producer One'));
    fireEvent.click(screen.getByText('Producer One'));

    fireEvent.click(screen.getByRole('button', { name: /Assign & Done/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const updatePayload = updateMock.mock.calls[0][0];
    expect(updatePayload.assigned_to_user_id).toBe('prod-1');
    expect(updatePayload.assigned_to_name).toBe('Producer One');
    expect(updatePayload.assigned_by_user_id).toBe('reviewer-uuid');
    expect(typeof updatePayload.assigned_at).toBe('string');

    await waitFor(() => expect(removeRow).toHaveBeenCalledWith('queue-row-id'));

    vi.unstubAllGlobals();
  });
});
