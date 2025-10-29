/**
 * Critical Accounts Modal Component
 *
 * Modal dialog for viewing all critical/problem accounts in Home Insurance
 * Provides search, filter, and sort capabilities
 * Created: 2025-10-27
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
import type { ProblemAccount } from '@/types/homeInsurance';

interface CriticalAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: ProblemAccount[];
}

export function CriticalAccountsModal({
  isOpen,
  onClose,
  accounts,
}: CriticalAccountsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterIssueType, setFilterIssueType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('severity');

  // Get unique issue types
  const issueTypes = useMemo(() => {
    const types = new Set(accounts.map(a => a.issue));
    return Array.from(types);
  }, [accounts]);

  // Filter and sort accounts
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        account =>
          account.email_address.toLowerCase().includes(term) ||
          account.workspace_name.toLowerCase().includes(term)
      );
    }

    // Severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(account => account.severity === filterSeverity);
    }

    // Issue type filter
    if (filterIssueType !== 'all') {
      filtered = filtered.filter(account => account.issue === filterIssueType);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'severity') {
        const severityOrder = { critical: 0, warning: 1 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      } else if (sortBy === 'workspace') {
        return a.workspace_name.localeCompare(b.workspace_name);
      } else if (sortBy === 'email') {
        return a.email_address.localeCompare(b.email_address);
      }
      return 0;
    });

    return filtered;
  }, [accounts, searchTerm, filterSeverity, filterIssueType, sortBy]);

  const handleDownloadCSV = () => {
    const headers = ['Email', 'Workspace', 'Status', 'Issue Type', 'Severity', 'Details'];
    const rows = filteredAccounts.map(account => [
      account.email_address,
      account.workspace_name,
      account.status || 'N/A',
      account.issue.replace(/_/g, ' '),
      account.severity,
      account.details,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `critical-accounts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity: string) => {
    return severity === 'critical'
      ? 'bg-red-500/20 text-red-400 border-red-500/40'
      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-gray-900 border-white/10">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-white text-xl flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Critical Accounts - Home Insurance
              </DialogTitle>
              <DialogDescription className="text-white/60 mt-1">
                {filteredAccounts.length} of {accounts.length} accounts shown
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
        <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-white/10">
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

          {/* Severity Filter */}
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>

          {/* Issue Type Filter */}
          <Select value={filterIssueType} onValueChange={setFilterIssueType}>
            <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="All Issue Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Issue Types</SelectItem>
              {issueTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="severity">Sort by Severity</SelectItem>
              <SelectItem value="workspace">Sort by Workspace</SelectItem>
              <SelectItem value="email">Sort by Email</SelectItem>
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

        {/* Table */}
        <div className="overflow-y-auto max-h-[500px]">
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12 text-white/60">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-white/30" />
              <p>No accounts match your filters</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-900 border-b border-white/10">
                <tr>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Email</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Workspace</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Issue</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Severity</th>
                  <th className="text-left text-white/70 text-xs font-semibold py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account, idx) => (
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
                      <div className="text-white/70 text-xs capitalize">
                        {account.issue.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className={getSeverityColor(account.severity)}>
                        {account.severity}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-white/60 text-xs max-w-md">{account.details}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
