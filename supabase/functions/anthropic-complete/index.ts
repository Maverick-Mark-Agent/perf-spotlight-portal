import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ANTHROPIC COMPLETE EDGE FUNCTION
 *
 * Securely proxies requests to the Anthropic Messages API using the server-side
 * ANTHROPIC_API_KEY stored in Supabase project secrets.
 *
 * Request body (JSON):
 * {
 *   model?: string;                 // default: "claude-3-5-sonnet-20240620"
 *   messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
 *   system?: string;                // optional system prompt
 *   max_tokens?: number;            // default: 1024
 *   temperature?: number;           // default: 0.7
 * }
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const body = await req.json();

    const model: string = body.model || 'claude-3-5-sonnet-20240620';
    const messages = body.messages as Array<{ role: string; content: string }>;
    const system: string | undefined = body.system;
    const maxTokens: number = typeof body.max_tokens === 'number' ? body.max_tokens : 1024;
    const temperature: number = typeof body.temperature === 'number' ? body.temperature : 0.7;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages[] is required');
    }

    // Anthropic Messages API payload
    const payload: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (system) {
      payload.system = system;
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        // Use a stable API version; update as needed per Anthropic docs
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      return new Response(
        JSON.stringify({ success: false, error: `Anthropic API error: ${anthropicResponse.status} - ${errorText}` }),
        { status: anthropicResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await anthropicResponse.json();

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


