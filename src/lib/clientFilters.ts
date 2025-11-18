/**
 * Client Filtering Utilities
 * 
 * Contains blacklists and whitelists for filtering clients in various dashboards and reports
 */

/**
 * Clients to exclude from Volume Dashboard and Daily Sending Volume Reports
 * These clients show "0 emails going out vs 0 needed" and should be hidden
 */
export const VOLUME_DASHBOARD_BLACKLIST = [
  'Maverick In-house',
  'LongRun',
  'Koppa Analytics',
  'Boring Book Keeping',
  'Radiant Energy',
  'Shane Miller',
  'ATI',
  'Ozment Media',
  'Littlegiant',
] as const;

/**
 * Check if a client should be excluded from volume reports
 * @param displayName - Client display name
 * @param workspaceName - Client workspace name (fallback)
 * @returns true if client should be excluded
 */
export function isClientExcludedFromVolume(
  displayName: string | null | undefined,
  workspaceName: string | null | undefined
): boolean {
  const name = (displayName || workspaceName || '').trim();
  if (!name) return false;
  
  return VOLUME_DASHBOARD_BLACKLIST.some(
    excluded => excluded.toLowerCase() === name.toLowerCase()
  );
}



