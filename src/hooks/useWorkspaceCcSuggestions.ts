import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const RECENT_REPLIES_SCAN_LIMIT = 500;

export const useWorkspaceCcSuggestions = (workspaceName: string | null) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceName) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;

    const fetchSuggestions = async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('sent_replies')
        .select('cc_emails')
        .eq('workspace_name', workspaceName)
        .order('created_at', { ascending: false })
        .limit(RECENT_REPLIES_SCAN_LIMIT);

      if (cancelled) return;

      if (queryError) {
        console.error('[useWorkspaceCcSuggestions] Error:', queryError);
        setError(queryError.message);
        setSuggestions([]);
        setLoading(false);
        return;
      }

      const seen = new Set<string>();
      const ordered: string[] = [];
      for (const row of data || []) {
        for (const raw of row.cc_emails || []) {
          if (typeof raw !== 'string') continue;
          const email = raw.trim().toLowerCase();
          if (!email || seen.has(email)) continue;
          seen.add(email);
          ordered.push(email);
        }
      }

      setSuggestions(ordered);
      setLoading(false);
    };

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [workspaceName]);

  return { suggestions, loading, error };
};
