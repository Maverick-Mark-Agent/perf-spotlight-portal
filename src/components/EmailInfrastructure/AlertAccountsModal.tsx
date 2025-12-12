/**
 * Alert Accounts Modal Component
 *
 * Modal dialog for viewing all accounts associated with an alert
 * Provides search, filter, and sort capabilities
 * Created: 2025-11-07
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, AlertTriangle, X, Download } from 'lucide-react';
import type { Alert } from '@/hooks/useAlerts';
import type { EmailAccount } from '@/hooks/useAlerts';

interface AlertAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: Alert | null;
  allAccounts: EmailAccount[] | null;
}

export function AlertAccountsModal({
  isOpen,
  onClose,
  alert,
  allAccounts,
}: AlertAccountsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('email');

  // Filter accounts based on alert criteria
  const filteredAccounts = useMemo(() => {
    if (!alert || !allAccounts || allAccounts.length === 0) {
      return [];
    }

    let accounts: EmailAccount[] = [];

    // Filter based on alert type and category
    switch (alert.category) {
      case 'connection':
        if (alert.title.includes('Disconnected')) {
          accounts = allAccounts.filter(a => a.status === 'disconnected');
        } else if (alert.title.includes('Failed')) {
          accounts = allAccounts.filter(a => a.status === 'failed');
        }
        break;

      case 'reliability':
        if (alert.title.includes('Failed')) {
          accounts = allAccounts.filter(a => a.status === 'failed');
        }
        break;

      case 'performance':
        if (alert.title.includes('High Bounce Rate')) {
          accounts = allAccounts.filter(a => {
            const bounceRate = a.emails_sent_count > 0 ? a.bounced_count / a.emails_sent_count : 0;
            return bounceRate > 0.05 && a.emails_sent_count > 50;
          });
        } else if (alert.title.includes('0% Reply Rate') || alert.title.includes('100+')) {
          accounts = allAccounts.filter(a =>
            a.emails_sent_count >= 100 && a.total_replied_count === 0
          );
        } else if (alert.title.includes('Low Reply Rate')) {
          accounts = allAccounts.filter(a => {
            const replyRate = a.emails_sent_count > 0 ? a.total_replied_count / a.emails_sent_count : 0;
            return replyRate < 0.02 && replyRate > 0 && a.emails_sent_count >= 50;
          });
        } else if (alert.title.includes('Burnt Mailbox')) {
          // Burnt mailboxes: < 0.4% reply rate with 200+ emails sent
          accounts = allAccounts.filter(a => {
            const replyRate = a.emails_sent_count > 0 ? (a.total_replied_count / a.emails_sent_count) * 100 : 0;
            return replyRate < 0.4 && a.emails_sent_count >= 200;
          });
        } else if (alert.title.includes('No Activity')) {
          accounts = allAccounts.filter(a =>
            a.status === 'connected' && a.emails_sent_count === 0
          );
        }
        break;

      case 'data':
        // Stale data - filter by last_synced_at age
        if (alert.title.includes('Stale') || alert.title.includes('Outdated')) {
          const dataAgeHours = alert.title.includes('Very Stale') ? 24 : 12;
          const cutoffTime = Date.now() - (dataAgeHours * 60 * 60 * 1000);
          accounts = allAccounts.filter(a => {
            if (!a.last_synced_at) return true;
            const syncTime = new Date(a.last_synced_at).getTime();
            return syncTime < cutoffTime;
          });
        }
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      accounts = accounts.filter(
        account =>
          account.email_address.toLowerCase().includes(term) ||
          account.workspace_name.toLowerCase().includes(term)
      );
    }

    // Sort
    accounts = [...accounts].sort((a, b) => {
      if (sortBy === 'email') {
        return a.email_address.localeCompare(b.email_address);
      } else if (sortBy === 'workspace') {
        return a.workspace_name.localeCompare(b.workspace_name);
      } else if (sortBy === 'sent') {
        return (b.emails_sent_count || 0) - (a.emails_sent_count || 0);
      } else if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      return 0;
    });

    return accounts;
  }, [alert, allAccounts, searchTerm, sortBy]);

  const handleDownloadCSV = () => {
    if (!alert) return;

    const headers = ['Email', 'Workspace', 'Provider', 'Reseller', 'Status', 'Sent', 'Replies', 'Bounce Rate', 'Reply Rate'];
    const rows = filteredAccounts.map(account => {
      const bounceRate = account.emails_sent_count > 0
        ? ((account.bounced_count / account.emails_sent_count) * 100).toFixed(2)
        : '0.00';
      const replyRate = account.emails_sent_count > 0
        ? ((account.total_replied_count / account.emails_sent_count) * 100).toFixed(2)
        : '0.00';

      return [
        account.email_address,
        account.workspace_name,
        account.email_provider || 'N/A',
        account.reseller || 'N/A',
        account.status || 'N/A',
        account.emails_sent_count || 0,
        account.total_replied_count || 0,
        `${bounceRate}%`,
        `${replyRate}%`,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const alertName = alert.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    a.download = `alert-accounts-${alertName}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'disconnected':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    }
  };

  if (!alert) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-gray-900 border-white/10 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-white text-xl flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${
                  alert.type === 'critical' ? 'text-red-500' :
                  alert.type === 'warning' ? 'text-yellow-500' :
                  'text-blue-500'
                }`} />
                {alert.title}
              </DialogTitle>
              <DialogDescription className="text-white/60 mt-1">
                {filteredAccounts.length} of {filteredAccounts.length} accounts shown
                {alert.count && alert.count > filteredAccounts.length && ` (${alert.count} total)`}
              </DialogDescription>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-white/10 flex-shrink-0">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              placeholder="Search email or workspace..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Sort by Email</SelectItem>
              <SelectItem value="workspace">Sort by Workspace</SelectItem>
              <SelectItem value="sent">Sort by Sent (High to Low)</SelectItem>
              <SelectItem value="status">Sort by Status</SelectItem>
            </SelectContent>
          </Select>

          {/* Download CSV */}
          <Button
            onClick={handleDownloadCSV}
            variant="outline"
            size="sm"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Alert Description */}
        <div className="bg-white/5 rounded-lg p-3 mb-4 flex-shrink-0">
          <p className="text-white/80 text-sm">{alert.description}</p>
          {alert.recommendation && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-white/70 text-xs">
                <strong>Recommendation:</strong> {alert.recommendation}
              </p>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12 text-white/60">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-white/30" />
              <p>No accounts match your filters</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-900 border-b border-white/10 z-10">
                <tr>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Email</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Workspace</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Provider</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Reseller</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Status</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Sent</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Replies</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Bounce Rate</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Reply Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account, idx) => {
                  const bounceRate = account.emails_sent_count > 0
                    ? ((account.bounced_count / account.emails_sent_count) * 100).toFixed(2)
                    : '0.00';
                  const replyRate = account.emails_sent_count > 0
                    ? ((account.total_replied_count / account.emails_sent_count) * 100).toFixed(2)
                    : '0.00';

                  return (
                    <tr
                      key={idx}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="text-white text-sm font-mono">{account.email_address}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-white/80 text-sm">{account.workspace_name}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-white/80 text-sm">{account.email_provider || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-white/80 text-sm">{account.reseller || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={getStatusColor(account.status)}>
                          {account.status || 'N/A'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-white/80 text-sm">{account.emails_sent_count?.toLocaleString() || 0}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-white/80 text-sm">{account.total_replied_count?.toLocaleString() || 0}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-white/80 text-sm">{bounceRate}%</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-white/80 text-sm">{replyRate}%</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}








