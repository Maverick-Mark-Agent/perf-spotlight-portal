import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ThreadMessage {
  id: string;
  type: 'incoming' | 'outgoing';
  text: string;
  timestamp: string;
  sender: {
    name: string;
    email: string;
  };
  sentiment?: 'positive' | 'negative' | 'neutral' | null;
  status?: string; // For outgoing: 'sent', 'generated', etc.
}

interface UseConversationThreadReturn {
  messages: ThreadMessage[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface UseConversationThreadParams {
  leadEmail: string;
  workspaceName: string;
  enabled?: boolean;
}

export function useConversationThread({
  leadEmail,
  workspaceName,
  enabled = true,
}: UseConversationThreadParams): UseConversationThreadReturn {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    if (!enabled || !leadEmail || !workspaceName) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch all incoming replies from this lead
      const { data: incomingReplies, error: incomingError } = await supabase
        .from('lead_replies')
        .select('id, reply_text, reply_date, first_name, last_name, lead_email, sentiment')
        .eq('lead_email', leadEmail)
        .eq('workspace_name', workspaceName)
        .order('reply_date', { ascending: true });

      if (incomingError) throw incomingError;

      // Fetch all outgoing replies to this lead
      const { data: outgoingReplies, error: outgoingError } = await supabase
        .from('sent_replies')
        .select('id, generated_reply_text, sent_at, lead_name, lead_email, status, sent_by')
        .eq('lead_email', leadEmail)
        .eq('workspace_name', workspaceName)
        .order('sent_at', { ascending: true });

      if (outgoingError) throw outgoingError;

      // Convert incoming replies to thread messages
      const incomingMessages: ThreadMessage[] = (incomingReplies || []).map((reply) => ({
        id: `incoming-${reply.id}`,
        type: 'incoming' as const,
        text: reply.reply_text || '',
        timestamp: reply.reply_date,
        sender: {
          name: [reply.first_name, reply.last_name].filter(Boolean).join(' ') || 'Lead',
          email: reply.lead_email,
        },
        sentiment: reply.sentiment,
      }));

      // Convert outgoing replies to thread messages
      const outgoingMessages: ThreadMessage[] = (outgoingReplies || []).map((reply) => ({
        id: `outgoing-${reply.id}`,
        type: 'outgoing' as const,
        text: reply.generated_reply_text || '',
        timestamp: reply.sent_at,
        sender: {
          name: reply.sent_by || 'Your Team',
          email: workspaceName,
        },
        status: reply.status,
      }));

      // Combine and sort by timestamp
      const allMessages = [...incomingMessages, ...outgoingMessages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setMessages(allMessages);
    } catch (err) {
      console.error('Error fetching conversation thread:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [leadEmail, workspaceName, enabled]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  return {
    messages,
    loading,
    error,
    refresh: fetchThread,
  };
}
