import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  AssistantMessage,
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantAttachment,
} from '@/types/expenses';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';

export type AssistantContext = 'expenses' | 'bank_transactions';

export interface AssistantContextData {
  pendingCount?: number;
  categorizedCount?: number;
  recurringCount?: number;
  categories?: { id: string; name: string }[];
}

export interface ConversationSession {
  id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  first_message?: string;
}

interface UseExpenseAssistantOptions {
  context?: AssistantContext;
  contextData?: AssistantContextData;
}

interface UseExpenseAssistantReturn {
  messages: AssistantMessage[];
  sessionId: string | null;
  loading: boolean;
  error: string | null;
  sessions: ConversationSession[];
  sessionsLoading: boolean;
  sendMessage: (message: string, attachments?: File[]) => Promise<void>;
  clearSession: () => void;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
}

export function useExpenseAssistant(options: UseExpenseAssistantOptions = {}): UseExpenseAssistantReturn {
  const { context = 'expenses', contextData } = options;
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const sendMessage = useCallback(async (message: string, attachments?: File[]) => {
    setLoading(true);
    setError(null);

    try {
      // Convert files to base64
      const processedAttachments: AssistantChatRequest['attachments'] = [];

      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          const base64 = await fileToBase64(file);
          processedAttachments.push({
            file_name: file.name,
            file_type: file.type,
            base64_content: base64,
          });
        }
      }

      // Add user message to local state immediately
      const userMessage: AssistantMessage = {
        id: `temp-${Date.now()}`,
        session_id: sessionId || '',
        role: 'user',
        content: message,
        attachments: processedAttachments.map(a => ({
          file_name: a.file_name,
          file_type: a.file_type,
        })),
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);

      // Send to edge function
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-expense-assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          session_id: sessionId,
          message,
          attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
          context,
          context_data: contextData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const result: AssistantChatResponse = await response.json();

      // Update session ID if new
      if (!sessionId && result.session_id) {
        setSessionId(result.session_id);
      }

      // Add assistant response to messages
      const assistantMessage: AssistantMessage = {
        id: `resp-${Date.now()}`,
        session_id: result.session_id,
        role: 'assistant',
        content: result.message,
        metadata: result.actions_taken,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');

      // Add error message
      const errorMessage: AssistantMessage = {
        id: `error-${Date.now()}`,
        session_id: sessionId || '',
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, context, contextData]);

  const clearSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      // Fetch all sessions with their message counts
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('expense_assistant_sessions')
        .select('id, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;

      if (sessionsData && sessionsData.length > 0) {
        // For each session, get the first message and count
        const sessionsWithDetails = await Promise.all(
          sessionsData.map(async (session) => {
            const { data: messagesData, count } = await supabase
              .from('expense_assistant_messages')
              .select('content', { count: 'exact' })
              .eq('session_id', session.id)
              .eq('role', 'user')
              .order('created_at', { ascending: true })
              .limit(1);

            return {
              id: session.id,
              created_at: session.created_at,
              updated_at: session.updated_at,
              message_count: count || 0,
              first_message: messagesData?.[0]?.content?.slice(0, 100) || 'New conversation',
            };
          })
        );

        // Filter out sessions with no messages
        setSessions(sessionsWithDetails.filter(s => s.message_count > 0));
      } else {
        setSessions([]);
      }
    } catch (err: any) {
      console.error('Error loading sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadSession = useCallback(async (targetSessionId: string) => {
    setLoading(true);
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('expense_assistant_messages')
        .select('*')
        .eq('session_id', targetSessionId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (messagesData) {
        setMessages(messagesData as AssistantMessage[]);
        setSessionId(targetSessionId);
      }
    } catch (err: any) {
      console.error('Error loading session:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    messages,
    sessionId,
    loading,
    error,
    sessions,
    sessionsLoading,
    sendMessage,
    clearSession,
    loadSessions,
    loadSession,
  };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default useExpenseAssistant;
