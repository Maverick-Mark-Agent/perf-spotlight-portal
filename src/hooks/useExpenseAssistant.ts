import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  AssistantMessage,
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantAttachment,
} from '@/types/expenses';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';

interface UseExpenseAssistantReturn {
  messages: AssistantMessage[];
  sessionId: string | null;
  loading: boolean;
  error: string | null;
  sendMessage: (message: string, attachments?: File[]) => Promise<void>;
  clearSession: () => void;
}

export function useExpenseAssistant(): UseExpenseAssistantReturn {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        } as AssistantChatRequest),
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
  }, [sessionId]);

  const clearSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  return {
    messages,
    sessionId,
    loading,
    error,
    sendMessage,
    clearSession,
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
