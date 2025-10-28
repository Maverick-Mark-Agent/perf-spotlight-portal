/**
 * Client Performance List Component
 *
 * Displays a list of Home Insurance clients with their performance metrics
 * Each client is collapsible to show individual email accounts
 * Created: 2025-10-27
 */

import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Mail, TrendingUp, AlertTriangle } from 'lucide-react';
import type { ClientPerformanceMetrics, HomeInsuranceEmailAccount } from '@/types/homeInsurance';

interface ClientPerformanceListProps {
  clients: ClientPerformanceMetrics[];
  accounts: HomeInsuranceEmailAccount[];
  onClientClick?: (workspaceName: string) => void;
}

export function ClientPerformanceList({ clients, accounts, onClientClick }: ClientPerformanceListProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const toggleClient = (workspaceName: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(workspaceName)) {
      newExpanded.delete(workspaceName);
    } else {
      newExpanded.add(workspaceName);
    }
    setExpandedClients(newExpanded);
  };

  const getClientAccounts = (workspaceName: string) => {
    return accounts.filter(a => a.workspace_name === workspaceName);
  };

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-white/70">
        No Home Insurance clients found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {clients.map((client) => {
        const clientAccounts = getClientAccounts(client.workspace_name);
        const isExpanded = expandedClients.has(client.workspace_name);

        return (
          <Collapsible
            key={client.workspace_name}
            className="bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <CollapsibleTrigger
                    className="hover:bg-white/10 p-1 rounded transition-colors"
                    onClick={() => toggleClient(client.workspace_name)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-white" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-white" />
                    )}
                  </CollapsibleTrigger>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg">
                      {client.display_name || client.workspace_name}
                    </h3>
                    <p className="text-white/60 text-sm mt-0.5">
                      {client.accountCount} email {client.accountCount === 1 ? 'account' : 'accounts'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {client.disconnectedCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {client.disconnectedCount} disconnected
                    </Badge>
                  )}
                  {client.failedCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {client.failedCount} failed
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40"
                  >
                    {client.connectedCount} connected
                  </Badge>
                </div>
              </div>

              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-6 gap-4">
                <div className="flex flex-col">
                  <span className="text-white/70 text-xs mb-1">Total Sent</span>
                  <div className="text-white font-semibold">{client.totalSent.toLocaleString()}</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/70 text-xs mb-1">Total Replies</span>
                  <div className="text-white font-semibold">{client.totalReplies.toLocaleString()}</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/70 text-xs mb-1">Reply Rate</span>
                  <div className={`font-semibold ${
                    client.replyRate >= 8 ? 'text-green-500' :
                    client.replyRate >= 5 ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {client.replyRate.toFixed(1)}%
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/70 text-xs mb-1">Total Bounces</span>
                  <div className="text-white font-semibold">{client.totalBounces.toLocaleString()}</div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/70 text-xs mb-1">Group Bounce Rate</span>
                  <div className={`font-semibold ${
                    client.bounceRate > 5 ? 'text-red-500' :
                    client.bounceRate > 2 ? 'text-yellow-500' :
                    'text-green-500'
                  }`}>
                    {client.bounceRate.toFixed(1)}%
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/70 text-xs mb-1">Avg Bounce/Acct</span>
                  <div className={`font-semibold ${
                    client.avgBounceRatePerAccount > 5 ? 'text-red-500' :
                    client.avgBounceRatePerAccount > 2 ? 'text-yellow-500' :
                    'text-green-500'
                  }`}>
                    {client.avgBounceRatePerAccount.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Expandable Account List */}
            <CollapsibleContent>
              <div className="border-t border-white/10 p-4 bg-white/5">
                <div className="space-y-2">
                  {clientAccounts.map((account, idx) => {
                    const totalSent = account.emails_sent_count || 0;
                    const totalReplied = account.total_replied_count || 0;
                    const bounced = account.bounced_count || 0;
                    const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(2) : '0.00';
                    const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(2) : '0.00';

                    return (
                      <div key={idx} className="bg-white/5 rounded p-3 text-sm hover:bg-white/10 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-dashboard-primary" />
                            <span className="text-white font-medium">{account.email_address}</span>
                          </div>
                          <Badge
                            variant={account.status === 'Connected' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {account.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-6 gap-2 text-white/70 ml-6">
                          <div>
                            <div className="text-xs">Provider</div>
                            <div className="text-white font-semibold text-xs">
                              {account.email_provider || 'Unknown'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs">Sent</div>
                            <div className="text-white font-semibold">{totalSent.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs">Replies</div>
                            <div className="text-white font-semibold">{totalReplied.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs">Reply Rate</div>
                            <div className={`font-semibold ${
                              parseFloat(replyRate) >= 8 ? 'text-green-500' :
                              parseFloat(replyRate) >= 5 ? 'text-yellow-500' :
                              'text-red-500'
                            }`}>
                              {replyRate}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs">Bounced</div>
                            <div className="text-white font-semibold">{bounced.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs">Bounce Rate</div>
                            <div className={`font-semibold ${
                              parseFloat(bounceRate) > 5 ? 'text-red-500' :
                              parseFloat(bounceRate) > 2 ? 'text-yellow-500' :
                              'text-green-500'
                            }`}>
                              {bounceRate}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
