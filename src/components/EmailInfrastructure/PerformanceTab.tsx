/**
 * Performance Tab Component
 *
 * Email provider performance analytics (Reseller/ESP/Top 100)
 * Created: 2025-10-27
 */

import { Activity, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

interface PerformanceTabProps {
  providerPerformanceView: string;
  setProviderPerformanceView: (value: string) => void;
  resellerStatsData: any[];
  espStatsData: any[];
  top100AccountsData: any[];
  noReplyAccountsData: {
    resellerStats: any[];
    espStats: any[];
    allAccounts: any[];
  };
  loading: boolean;
  expandedProviders: Set<string>;
  toggleProvider: (name: string) => void;
}

export function PerformanceTab({
  providerPerformanceView,
  setProviderPerformanceView,
  resellerStatsData,
  espStatsData,
  top100AccountsData,
  noReplyAccountsData,
  loading,
  expandedProviders,
  toggleProvider
}: PerformanceTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold">Email Provider Performance</h2>
        <p className="text-white/60 text-sm mt-1">
          Analytics by reseller, ESP, and top performing accounts
        </p>
      </div>

      {/* Email Provider Performance Updates */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-dashboard-accent" />
            <span>Email Provider Performance Updates</span>
          </CardTitle>
          <div className="flex items-center space-x-4 mt-4">
            <label className="text-white/70 text-sm">View:</label>
            <Select value={providerPerformanceView} onValueChange={(value) => setProviderPerformanceView(value)}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reseller">Stats by Reseller</SelectItem>
                <SelectItem value="esp">Stats by ESP</SelectItem>
                <SelectItem value="top100">Top 100 Performers (50+ sent)</SelectItem>
                <SelectItem value="accounts50">Accounts 50+ (Enhanced)</SelectItem>
                <SelectItem value="no-replies">150+ No Replies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-white/70">Loading performance data...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* VIEW 1: Stats by Reseller */}
              {providerPerformanceView === 'reseller' && (
                <div className="space-y-4">
                  {resellerStatsData.length === 0 ? (
                    <div className="text-white/70 text-center py-8">No reseller data available</div>
                  ) : (
                    resellerStatsData.map((reseller: any) => (
                      <Collapsible key={reseller.name} className="bg-white/5 rounded-lg border border-white/10">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3 flex-1">
                              <CollapsibleTrigger
                                className="hover:bg-white/10 p-1 rounded transition-colors"
                                onClick={() => toggleProvider(reseller.name)}
                              >
                                {expandedProviders.has(reseller.name) ? (
                                  <ChevronDown className="h-5 w-5 text-white" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-white" />
                                )}
                              </CollapsibleTrigger>
                              <h3 className="text-white font-semibold text-lg">{reseller.name}</h3>
                            </div>
                            <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                              {reseller.totalAccounts} accounts
                            </Badge>
                          </div>
                          <div className="grid grid-cols-6 gap-4 mt-3">
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Total Sent</span>
                              <div className="text-white font-semibold">{reseller.totalSent.toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Total Replies</span>
                              <div className="text-white font-semibold">{reseller.totalReplies.toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Reply Rate</span>
                              <div className="text-white font-semibold">{reseller.replyRate}%</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Total Bounces</span>
                              <div className="text-white font-semibold">{reseller.totalBounces.toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Group Bounce Rate</span>
                              <div className="text-white font-semibold">{reseller.groupBounceRate}%</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Avg Bounce/Acct</span>
                              <div className="text-white font-semibold">{reseller.avgBounceRatePerAccount}%</div>
                            </div>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="border-t border-white/10 p-4 bg-white/5">
                            <div className="space-y-2">
                              {reseller.accounts.map((account: any, idx: number) => {
                                const totalSent = parseFloat(account.fields['Total Sent']) || 0;
                                const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
                                const bounced = parseFloat(account.fields['Bounced']) || 0;
                                const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(2) : '0.00';
                                const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(2) : '0.00';

                                return (
                                  <div key={idx} className="bg-white/5 rounded p-3 text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-white font-medium">{account.fields['Email'] || account.fields['Name'] || 'No email'}</span>
                                      <Badge
                                        variant={account.fields['Status'] === 'Connected' ? 'default' : 'destructive'}
                                        className="text-xs"
                                      >
                                        {account.fields['Status']}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 text-white/70">
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
                                        <div className="text-white font-semibold">{replyRate}%</div>
                                      </div>
                                      <div>
                                        <div className="text-xs">Bounced</div>
                                        <div className="text-white font-semibold">{bounced.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs">Bounce Rate</div>
                                        <div className="text-white font-semibold">{bounceRate}%</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )}
                </div>
              )}

              {/* VIEW 2: Stats by ESP */}
              {providerPerformanceView === 'esp' && (
                <div className="space-y-4">
                  {espStatsData.length === 0 ? (
                    <div className="text-white/70 text-center py-8">No ESP data available</div>
                  ) : (
                    espStatsData.map((esp: any) => (
                      <Collapsible key={esp.name} className="bg-white/5 rounded-lg border border-white/10">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3 flex-1">
                              <CollapsibleTrigger
                                className="hover:bg-white/10 p-1 rounded transition-colors"
                                onClick={() => toggleProvider(esp.name)}
                              >
                                {expandedProviders.has(esp.name) ? (
                                  <ChevronDown className="h-5 w-5 text-white" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-white" />
                                )}
                              </CollapsibleTrigger>
                              <h3 className="text-white font-semibold text-lg">{esp.name}</h3>
                            </div>
                            <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                              {esp.totalAccounts} accounts
                            </Badge>
                          </div>
                          <div className="grid grid-cols-6 gap-4 mt-3">
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Total Sent</span>
                              <div className="text-white font-semibold">{esp.totalSent.toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Total Replies</span>
                              <div className="text-white font-semibold">{esp.totalReplies.toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Reply Rate</span>
                              <div className="text-white font-semibold">{esp.replyRate}%</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Total Bounces</span>
                              <div className="text-white font-semibold">{esp.totalBounces.toLocaleString()}</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Group Bounce Rate</span>
                              <div className="text-white font-semibold">{esp.groupBounceRate}%</div>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/70 text-xs mb-1">Avg Bounce/Acct</span>
                              <div className="text-white font-semibold">{esp.avgBounceRatePerAccount}%</div>
                            </div>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="border-t border-white/10 p-4 bg-white/5">
                            <div className="space-y-2">
                              {esp.accounts.map((account: any, idx: number) => {
                                const totalSent = parseFloat(account.fields['Total Sent']) || 0;
                                const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
                                const bounced = parseFloat(account.fields['Bounced']) || 0;
                                const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(2) : '0.00';
                                const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(2) : '0.00';

                                return (
                                  <div key={idx} className="bg-white/5 rounded p-3 text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-white font-medium">{account.fields['Email'] || account.fields['Name'] || 'No email'}</span>
                                      <Badge
                                        variant={account.fields['Status'] === 'Connected' ? 'default' : 'destructive'}
                                        className="text-xs"
                                      >
                                        {account.fields['Status']}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 text-white/70">
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
                                        <div className="text-white font-semibold">{replyRate}%</div>
                                      </div>
                                      <div>
                                        <div className="text-xs">Bounced</div>
                                        <div className="text-white font-semibold">{bounced.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs">Bounce Rate</div>
                                        <div className="text-white font-semibold">{bounceRate}%</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )}
                </div>
              )}

              {/* VIEW 3: Top 100 Performers */}
              {providerPerformanceView === 'top100' && (
                <div>
                  {top100AccountsData.length === 0 ? (
                    <div className="text-white/70 text-center py-8">No accounts with 50+ emails sent</div>
                  ) : (
                    <>
                      {/* Summary metrics */}
                      <div className="grid grid-cols-6 gap-4 mb-6 p-4 bg-white/10 rounded-lg">
                        <div>
                          <div className="text-white/70 text-xs mb-1">Total Accounts</div>
                          <div className="text-white font-bold">{top100AccountsData.length}</div>
                        </div>
                        <div>
                          <div className="text-white/70 text-xs mb-1">Total Sent</div>
                          <div className="text-white font-bold">
                            {top100AccountsData.reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Total Sent']) || 0), 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70 text-xs mb-1">Total Replies</div>
                          <div className="text-white font-bold">
                            {top100AccountsData.reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Total Replied']) || 0), 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70 text-xs mb-1">Avg Reply Rate</div>
                          <div className="text-white font-bold">
                            {(top100AccountsData.reduce((sum, acc: any) => sum + acc.calculatedReplyRate, 0) / top100AccountsData.length).toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70 text-xs mb-1">Total Bounces</div>
                          <div className="text-white font-bold">
                            {top100AccountsData.reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Bounced']) || 0), 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70 text-xs mb-1">Avg Bounce Rate</div>
                          <div className="text-white font-bold">
                            {(() => {
                              const totalSent = top100AccountsData.reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Total Sent']) || 0), 0);
                              const totalBounced = top100AccountsData.reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Bounced']) || 0), 0);
                              return totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(2) : '0.00';
                            })()}%
                          </div>
                        </div>
                      </div>

                      {/* Account list */}
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {top100AccountsData.map((account: any, idx: number) => {
                          const totalSent = parseFloat(account.fields['Total Sent']) || 0;
                          const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
                          const bounced = parseFloat(account.fields['Bounced']) || 0;
                          const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(2) : '0.00';

                          return (
                            <div key={idx} className="bg-white/5 rounded p-3 border border-white/10">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-dashboard-accent/20 text-dashboard-accent border-dashboard-accent/40">
                                    #{idx + 1}
                                  </Badge>
                                  <span className="text-white font-medium">{account.fields['Email'] || account.fields['Name'] || 'No email'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-dashboard-success font-semibold">{account.calculatedReplyRate.toFixed(2)}% reply rate</span>
                                  <Badge
                                    variant={account.fields['Status'] === 'Connected' ? 'default' : 'destructive'}
                                    className="text-xs"
                                  >
                                    {account.fields['Status']}
                                  </Badge>
                                </div>
                              </div>
                              <div className="grid grid-cols-6 gap-2 text-sm text-white/70">
                                <div>
                                  <div className="text-xs">ESP</div>
                                  <div className="text-white font-semibold">{account.fields['Tag - Email Provider'] || 'N/A'}</div>
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
                                  <div className="text-xs">Bounced</div>
                                  <div className="text-white font-semibold">{bounced.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-xs">Bounce Rate</div>
                                  <div className="text-white font-semibold">{bounceRate}%</div>
                                </div>
                                <div>
                                  <div className="text-xs">Client</div>
                                  <div className="text-white font-semibold text-xs truncate">{account.fields['Client Name (from Client)']?.[0] || 'Unknown'}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* VIEW 4: Accounts 50+ (Enhanced) - Placeholder for now */}
              {providerPerformanceView === 'accounts50' && (
                <div className="text-white/70 text-center py-8">
                  This view will be implemented using enhanced version of existing functionality
                </div>
              )}

              {/* VIEW 5: 150+ No Replies */}
              {(providerPerformanceView === 'no-replies' || providerPerformanceView === 'no-replies-reseller' || providerPerformanceView === 'no-replies-esp' || providerPerformanceView === 'no-replies-all') && (
                <div className="space-y-4">
                  {(() => {
                    console.log('[PerformanceTab] 150+ No Replies view - Debug:', {
                      providerPerformanceView,
                      hasNoReplyData: !!noReplyAccountsData,
                      noReplyDataKeys: noReplyAccountsData ? Object.keys(noReplyAccountsData) : [],
                      allAccountsLength: noReplyAccountsData?.allAccounts?.length ?? 'undefined',
                      resellerStatsLength: noReplyAccountsData?.resellerStats?.length ?? 'undefined',
                      espStatsLength: noReplyAccountsData?.espStats?.length ?? 'undefined',
                    });
                    return null;
                  })()}
                  {!noReplyAccountsData || !noReplyAccountsData.allAccounts || noReplyAccountsData.allAccounts.length === 0 ? (
                    <div className="text-white/70 text-center py-8">
                      {!noReplyAccountsData || !noReplyAccountsData.allAccounts
                        ? 'Loading 150+ No Replies data...'
                        : 'No accounts found with 150+ sent and 0 replies'}
                    </div>
                  ) : (
                    <>
                      {/* Summary metrics */}
                      <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-white/10 rounded-lg">
                        <div>
                          <div className="text-white/70 text-xs mb-1">Total Accounts</div>
                          <div className="text-white font-bold">{noReplyAccountsData.allAccounts?.length || 0}</div>
                        </div>
                        <div>
                          <div className="text-white/70 text-xs mb-1">Total Sent</div>
                          <div className="text-white font-bold">
                            {(noReplyAccountsData.allAccounts || []).reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Total Sent']) || 0), 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70 text-xs mb-1">Total Bounces</div>
                          <div className="text-white font-bold">
                            {(noReplyAccountsData.allAccounts || []).reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Bounced']) || 0), 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70 text-xs mb-1">Avg Bounce Rate</div>
                          <div className="text-white font-bold">
                            {(() => {
                              const allAccounts = noReplyAccountsData.allAccounts || [];
                              const totalSent = allAccounts.reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Total Sent']) || 0), 0);
                              const totalBounced = allAccounts.reduce((sum, acc: any) => sum + (parseFloat(acc.fields['Bounced']) || 0), 0);
                              return totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(2) : '0.00';
                            })()}%
                          </div>
                        </div>
                      </div>

                  {/* Toggle between Reseller and ESP view */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setProviderPerformanceView('no-replies-reseller')}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        providerPerformanceView === 'no-replies' || providerPerformanceView === 'no-replies-reseller'
                          ? 'bg-dashboard-primary text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      By Reseller
                    </button>
                    <button
                      onClick={() => setProviderPerformanceView('no-replies-esp')}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        providerPerformanceView === 'no-replies-esp'
                          ? 'bg-dashboard-primary text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      By ESP
                    </button>
                    <button
                      onClick={() => setProviderPerformanceView('no-replies-all')}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        providerPerformanceView === 'no-replies-all'
                          ? 'bg-dashboard-primary text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      All Accounts
                    </button>
                  </div>

                  {/* By Reseller View (default when no-replies is selected) */}
                  {(providerPerformanceView === 'no-replies' || providerPerformanceView === 'no-replies-reseller') && (
                    <div className="space-y-4">
                      {noReplyAccountsData.resellerStats.length === 0 ? (
                        <div className="text-white/70 text-center py-8">No accounts with 150+ sent and 0 replies</div>
                      ) : (
                        noReplyAccountsData.resellerStats.map((reseller: any) => (
                          <Collapsible key={reseller.name} className="bg-white/5 rounded-lg border border-white/10">
                            <div className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3 flex-1">
                                  <CollapsibleTrigger
                                    className="hover:bg-white/10 p-1 rounded transition-colors"
                                    onClick={() => toggleProvider(reseller.name)}
                                  >
                                    {expandedProviders.has(reseller.name) ? (
                                      <ChevronDown className="h-5 w-5 text-white" />
                                    ) : (
                                      <ChevronRight className="h-5 w-5 text-white" />
                                    )}
                                  </CollapsibleTrigger>
                                  <h3 className="text-white font-semibold text-lg">{reseller.name}</h3>
                                </div>
                                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/40">
                                  {reseller.totalAccounts} accounts
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-4 mt-3">
                                <div className="flex flex-col">
                                  <span className="text-white/70 text-xs mb-1">Total Sent</span>
                                  <div className="text-white font-semibold">{reseller.totalSent.toLocaleString()}</div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-white/70 text-xs mb-1">Total Bounces</span>
                                  <div className="text-white font-semibold">{reseller.totalBounces.toLocaleString()}</div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-white/70 text-xs mb-1">Bounce Rate</span>
                                  <div className="text-white font-semibold">{reseller.bounceRate}%</div>
                                </div>
                              </div>
                            </div>
                            <CollapsibleContent>
                              <div className="border-t border-white/10 p-4 bg-white/5">
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                  {reseller.accounts.map((account: any, idx: number) => {
                                    const totalSent = parseFloat(account.fields['Total Sent']) || 0;
                                    const bounced = parseFloat(account.fields['Bounced']) || 0;
                                    const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(2) : '0.00';

                                    return (
                                      <div key={idx} className="bg-white/5 rounded p-3 text-sm">
                                        <div className="flex justify-between items-start mb-2">
                                          <span className="text-white font-medium">{account.fields['Email'] || account.fields['Name'] || 'No email'}</span>
                                          <Badge
                                            variant={account.fields['Status'] === 'Connected' ? 'default' : 'destructive'}
                                            className="text-xs"
                                          >
                                            {account.fields['Status']}
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-white/70">
                                          <div>
                                            <div className="text-xs">Sent</div>
                                            <div className="text-white font-semibold">{totalSent.toLocaleString()}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs">Bounced</div>
                                            <div className="text-white font-semibold">{bounced.toLocaleString()}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs">Bounce Rate</div>
                                            <div className="text-white font-semibold">{bounceRate}%</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))
                      )}
                    </div>
                  )}

                  {/* By ESP View */}
                  {providerPerformanceView === 'no-replies-esp' && (
                    <div className="space-y-4">
                      {noReplyAccountsData.espStats.length === 0 ? (
                        <div className="text-white/70 text-center py-8">No accounts with 150+ sent and 0 replies</div>
                      ) : (
                        noReplyAccountsData.espStats.map((esp: any) => (
                          <Collapsible key={esp.name} className="bg-white/5 rounded-lg border border-white/10">
                            <div className="p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3 flex-1">
                                  <CollapsibleTrigger
                                    className="hover:bg-white/10 p-1 rounded transition-colors"
                                    onClick={() => toggleProvider(esp.name)}
                                  >
                                    {expandedProviders.has(esp.name) ? (
                                      <ChevronDown className="h-5 w-5 text-white" />
                                    ) : (
                                      <ChevronRight className="h-5 w-5 text-white" />
                                    )}
                                  </CollapsibleTrigger>
                                  <h3 className="text-white font-semibold text-lg">{esp.name}</h3>
                                </div>
                                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/40">
                                  {esp.totalAccounts} accounts
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-4 mt-3">
                                <div className="flex flex-col">
                                  <span className="text-white/70 text-xs mb-1">Total Sent</span>
                                  <div className="text-white font-semibold">{esp.totalSent.toLocaleString()}</div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-white/70 text-xs mb-1">Total Bounces</span>
                                  <div className="text-white font-semibold">{esp.totalBounces.toLocaleString()}</div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-white/70 text-xs mb-1">Bounce Rate</span>
                                  <div className="text-white font-semibold">{esp.bounceRate}%</div>
                                </div>
                              </div>
                            </div>
                            <CollapsibleContent>
                              <div className="border-t border-white/10 p-4 bg-white/5">
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                  {esp.accounts.map((account: any, idx: number) => {
                                    const totalSent = parseFloat(account.fields['Total Sent']) || 0;
                                    const bounced = parseFloat(account.fields['Bounced']) || 0;
                                    const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(2) : '0.00';

                                    return (
                                      <div key={idx} className="bg-white/5 rounded p-3 text-sm">
                                        <div className="flex justify-between items-start mb-2">
                                          <span className="text-white font-medium">{account.fields['Email'] || account.fields['Name'] || 'No email'}</span>
                                          <Badge
                                            variant={account.fields['Status'] === 'Connected' ? 'default' : 'destructive'}
                                            className="text-xs"
                                          >
                                            {account.fields['Status']}
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-white/70">
                                          <div>
                                            <div className="text-xs">Sent</div>
                                            <div className="text-white font-semibold">{totalSent.toLocaleString()}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs">Bounced</div>
                                            <div className="text-white font-semibold">{bounced.toLocaleString()}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs">Bounce Rate</div>
                                            <div className="text-white font-semibold">{bounceRate}%</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))
                      )}
                    </div>
                  )}

                  {/* All Accounts View */}
                  {providerPerformanceView === 'no-replies-all' && (
                    <div>
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {noReplyAccountsData.allAccounts.length === 0 ? (
                          <div className="text-white/70 text-center py-8">No accounts with 150+ sent and 0 replies</div>
                        ) : (
                          noReplyAccountsData.allAccounts.map((account: any, idx: number) => {
                            const totalSent = parseFloat(account.fields['Total Sent']) || 0;
                            const bounced = parseFloat(account.fields['Bounced']) || 0;
                            const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(2) : '0.00';

                            return (
                              <div key={idx} className="bg-white/5 rounded p-3 border border-white/10">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/40">
                                      #{idx + 1}
                                    </Badge>
                                    <span className="text-white font-medium">{account.fields['Email'] || account.fields['Name'] || 'No email'}</span>
                                  </div>
                                  <Badge
                                    variant={account.fields['Status'] === 'Connected' ? 'default' : 'destructive'}
                                    className="text-xs"
                                  >
                                    {account.fields['Status']}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-5 gap-2 text-sm text-white/70">
                                  <div>
                                    <div className="text-xs">Reseller</div>
                                    <div className="text-white font-semibold">{account.fields['Tag - Reseller'] || 'N/A'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs">ESP</div>
                                    <div className="text-white font-semibold">{account.fields['Tag - Email Provider'] || 'N/A'}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs">Sent</div>
                                    <div className="text-white font-semibold">{totalSent.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs">Bounced</div>
                                    <div className="text-white font-semibold">{bounced.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs">Bounce Rate</div>
                                    <div className="text-white font-semibold">{bounceRate}%</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
