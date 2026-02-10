import { supabase } from "@/integrations/supabase/client";

export interface AnthropicMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AnthropicCompleteParams {
  model?: string;
  messages: AnthropicMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
}

export async function anthropicComplete(params: AnthropicCompleteParams) {
  const { data, error } = await supabase.functions.invoke('anthropic-complete', {
    body: params,
  });

  if (error) {
    throw error;
  }

  return data as { success: boolean; data?: unknown; error?: string };
}


