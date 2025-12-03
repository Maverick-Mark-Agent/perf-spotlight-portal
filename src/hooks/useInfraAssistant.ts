import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  InfraAssistantMessage,
  InfraChatRequest,
  InfraChatResponse,
} from '@/types/infraAssistant';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';

export interface InfraConversationSession {
  id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  first_message?: string;
}

interface DetectedIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  workspace?: string;
}

interface UseInfraAssistantReturn {
  messages: InfraAssistantMessage[];
  sessionId: string | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  error: string | null;
  sessions: InfraConversationSession[];
  sessionsLoading: boolean;
  detectedIssues: DetectedIssue[];
  sendMessage: (message: string) => Promise<void>;
  clearSession: () => void;
  clearHistory: () => void; // Alias for clearSession
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
}

export function useInfraAssistant(): UseInfraAssistantReturn {
  const [messages, setMessages] = useState<InfraAssistantMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<InfraConversationSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const sendMessage = useCallback(async (message: string) => {
    setLoading(true);
    setError(null);

    try {
      // Add user message to local state immediately
      const userMessage: InfraAssistantMessage = {
        id: `temp-${Date.now()}`,
        session_id: sessionId || '',
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);

      // Send to edge function
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/infra-ai-assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          session_id: sessionId,
          message,
        } as InfraChatRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const result: InfraChatResponse = await response.json();

      // Update session ID if new
      if (!sessionId && result.session_id) {
        setSessionId(result.session_id);
      }

      // Add assistant response to messages
      const assistantMessage: InfraAssistantMessage = {
        id: `resp-${Date.now()}`,
        session_id: result.session_id,
        role: 'assistant',
        content: result.message,
        intent: result.intent,
        entities: result.entities,
        metadata: result.metadata,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');

      // Add error message
      const errorMessage: InfraAssistantMessage = {
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
  }, [sessionId]);

  const clearSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      // Fetch all sessions with their message counts
      const { data: sessionsData, error: sessionsError } = await (supabase as any)
        .from('infra_assistant_sessions')
        .select('id, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;

      if (sessionsData && sessionsData.length > 0) {
        // For each session, get the first message and count
        const sessionsWithDetails = await Promise.all(
          sessionsData.map(async (session: any) => {
            const { data: messagesData, count } = await (supabase as any)
              .from('infra_assistant_messages')
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
        setSessions(sessionsWithDetails.filter((s: any) => s.message_count > 0));
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
      const { data: messagesData, error: messagesError } = await (supabase as any)
        .from('infra_assistant_messages')
        .select('*')
        .eq('session_id', targetSessionId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (messagesData) {
        setMessages(messagesData as InfraAssistantMessage[]);
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
    isLoading: loading,
    error,
    sessions,
    sessionsLoading,
    detectedIssues: [], // Will be populated by future issue detection
    sendMessage,
    clearSession,
    clearHistory: clearSession,
    loadSessions,
    loadSession,
  };
}

export default useInfraAssistant;
