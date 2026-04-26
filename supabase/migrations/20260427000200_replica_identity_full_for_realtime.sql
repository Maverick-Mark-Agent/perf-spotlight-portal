-- REPLICA IDENTITY FULL ensures Realtime UPDATE events broadcast the
-- entire row, not just the primary key. Without this, an UPDATE that
-- changes verified_at from NULL to a timestamp may broadcast only id=N
-- and the client can't tell what changed without a refetch.
--
-- The frontend currently does refetch on any UPDATE so this isn't strictly
-- breaking anything, but FULL is best practice for tables that drive UI
-- state and avoids edge cases where UPDATE events get filtered or batched.
ALTER TABLE sent_replies REPLICA IDENTITY FULL;
ALTER TABLE lead_replies REPLICA IDENTITY FULL;
