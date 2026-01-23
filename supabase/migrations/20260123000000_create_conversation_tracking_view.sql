-- Create conversation tracking view for identifying back-and-forth communication
-- This is a READ-ONLY view that aggregates reply counts per lead
-- SAFE: Does not modify the lead_replies table in any way

-- Create the aggregation view
CREATE OR REPLACE VIEW public.lead_conversation_stats AS
SELECT
  lead_email,
  workspace_name,
  COUNT(*) as reply_count,
  MIN(reply_date) as first_reply_date,
  MAX(reply_date) as latest_reply_date,
  COUNT(*) FILTER (WHERE reply_date > NOW() - INTERVAL '7 days') as replies_last_7_days,
  CASE
    WHEN COUNT(*) >= 3 AND COUNT(*) FILTER (WHERE reply_date > NOW() - INTERVAL '7 days') >= 2 THEN 'hot'
    WHEN COUNT(*) >= 2 THEN 'in_conversation'
    ELSE 'single_reply'
  END as conversation_status
FROM public.lead_replies
GROUP BY lead_email, workspace_name;

-- Create index-friendly materialized approach via a function for better performance
-- This function can be called to get conversation stats for a specific workspace
CREATE OR REPLACE FUNCTION public.get_conversation_stats(p_workspace_name TEXT DEFAULT NULL)
RETURNS TABLE (
  lead_email TEXT,
  workspace_name TEXT,
  reply_count BIGINT,
  first_reply_date TIMESTAMP WITH TIME ZONE,
  latest_reply_date TIMESTAMP WITH TIME ZONE,
  replies_last_7_days BIGINT,
  conversation_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lr.lead_email,
    lr.workspace_name,
    COUNT(*)::BIGINT as reply_count,
    MIN(lr.reply_date) as first_reply_date,
    MAX(lr.reply_date) as latest_reply_date,
    COUNT(*) FILTER (WHERE lr.reply_date > NOW() - INTERVAL '7 days')::BIGINT as replies_last_7_days,
    CASE
      WHEN COUNT(*) >= 3 AND COUNT(*) FILTER (WHERE lr.reply_date > NOW() - INTERVAL '7 days') >= 2 THEN 'hot'
      WHEN COUNT(*) >= 2 THEN 'in_conversation'
      ELSE 'single_reply'
    END as conversation_status
  FROM public.lead_replies lr
  WHERE (p_workspace_name IS NULL OR lr.workspace_name = p_workspace_name)
  GROUP BY lr.lead_email, lr.workspace_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create the main view that joins lead_replies with conversation stats
-- This is what the frontend will query
CREATE OR REPLACE VIEW public.lead_replies_with_conversation AS
SELECT
  lr.*,
  COALESCE(stats.reply_count, 1) as conversation_reply_count,
  stats.first_reply_date as conversation_first_reply_date,
  stats.latest_reply_date as conversation_latest_reply_date,
  COALESCE(stats.replies_last_7_days, 1) as conversation_replies_last_7_days,
  COALESCE(stats.conversation_status, 'single_reply') as conversation_status
FROM public.lead_replies lr
LEFT JOIN public.lead_conversation_stats stats
  ON lr.lead_email = stats.lead_email
  AND lr.workspace_name = stats.workspace_name;

-- Grant access to the view (same as lead_replies table)
GRANT SELECT ON public.lead_conversation_stats TO authenticated;
GRANT SELECT ON public.lead_conversation_stats TO anon;
GRANT SELECT ON public.lead_replies_with_conversation TO authenticated;
GRANT SELECT ON public.lead_replies_with_conversation TO anon;

-- Add comments for documentation
COMMENT ON VIEW public.lead_conversation_stats IS 'Aggregated conversation statistics per lead_email and workspace. Shows reply counts and conversation status.';
COMMENT ON VIEW public.lead_replies_with_conversation IS 'Lead replies enriched with conversation tracking data. Use this view instead of lead_replies table for dashboard queries.';
COMMENT ON FUNCTION public.get_conversation_stats IS 'Returns conversation statistics, optionally filtered by workspace. More efficient for single-workspace queries.';

-- Verification
SELECT 'Conversation tracking view created successfully!' as status;
