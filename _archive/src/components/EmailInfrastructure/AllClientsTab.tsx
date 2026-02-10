/**
 * All Clients Tab Component
 *
 * Comprehensive view of all email accounts across all clients
 * This will eventually contain the existing account table and filters
 * Created: 2025-10-27
 */

import { Users } from 'lucide-react';

interface AllClientsTabProps {
  // Will receive existing table data and handlers
  // when we migrate the existing section here
}

export function AllClientsTab({}: AllClientsTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold">All Email Accounts</h2>
        <p className="text-white/60 text-sm mt-1">
          Comprehensive view of all email accounts across all clients
        </p>
      </div>

      {/* Placeholder - existing account table will be moved here */}
      <div className="bg-white/5 rounded-lg border border-white/10 p-8 text-center">
        <Users className="h-12 w-12 text-dashboard-primary mx-auto mb-4" />
        <h3 className="text-white text-xl font-semibold mb-2">All Email Accounts</h3>
        <p className="text-white/60">
          Existing email accounts table will be moved here
        </p>
        <p className="text-white/40 text-sm mt-2">
          Currently displayed below (will be migrated in refactor step)
        </p>
      </div>
    </div>
  );
}
