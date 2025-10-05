import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Users, CheckCircle, XCircle, RefreshCw, Activity, ChevronDown, ChevronRight, DollarSign, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDashboardContext } from "@/contexts/DashboardContext";

// Removed localStorage caching due to quota limits with large dataset (4000+ accounts)
// Data is now fetched fresh on each page load for real-time accuracy

const SendingAccountsInfrastructure = () => {
  const {
    infrastructureDashboard,
    setInfrastructureFilter,
    setInfrastructureExpandedAccountTypes,
    setInfrastructureExpandedStatuses,
    setInfrastructureSelectedClient,
    setInfrastructureModalOpen,
    refreshInfrastructure,
  } = useDashboardContext();

  const {
    emailAccounts,
    filters,
    expandedAccountTypes,
    expandedStatuses,
    selectedClient,
    isClientModalOpen,
    loading,
    lastUpdated,
  } = infrastructureDashboard;

  // Destructure filters for easier access
  const {
    selectedAnalysis,
    selectedProviderView,
    selectedClientForSending,
    clientAccountFilter,
  } = filters;

  const [loadingMessage, setLoadingMessage] = useState('Fetching all records...');
  // Local UI state for computed data
  const [accountStats, setAccountStats] = useState({
    total: 0,
    avgPerClient: '0',
    connected: 0,
    disconnected: 0,
    totalPrice: 0,
    avgCostPerClient: '0'
  });
  const [resellerData, setResellerData] = useState([]);
  const [accountTypeData, setAccountTypeData] = useState([]);
  const [priceAnalysisData, setPriceAnalysisData] = useState([]);
  const [clientAccountsData, setClientAccountsData] = useState([]);
  const [emailProviderData, setEmailProviderData] = useState([]);
  const [clientSendingData, setClientSendingData] = useState([]);

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return lastUpdated.toLocaleString();
  };

  // Function to download accounts with 0% reply rate and 50+ emails sent as CSV
  const downloadZeroReplyRateAccounts = useCallback(() => {
    const filteredAccounts = emailAccounts.filter(account => {
      const totalSent = parseFloat(account.fields['Total Sent']) || 0;
      const replyRateRaw = account.fields['Reply Rate Per Account %'];
      const replyRate = typeof replyRateRaw === 'number' ? replyRateRaw : parseFloat(replyRateRaw);
      
      // Check if reply rate is 0 and total sent is over 50
      return totalSent > 50 && replyRate === 0;
    });

    if (filteredAccounts.length === 0) {
      alert('No accounts found matching the criteria (0% reply rate with 50+ emails sent)');
      return;
    }

    // Create CSV content
    const headers = ['Account Name', 'Client', 'Email Provider', 'Total Sent', 'Reply Rate %', 'Daily Limit', 'Status'];
    const csvRows = [headers.join(',')];

    filteredAccounts.forEach(account => {
      const row = [
        `"${account.fields['Account Name'] || ''}"`,
        `"${account.fields['Client'] || ''}"`,
        `"${account.fields['Tag - Email Provider'] || ''}"`,
        account.fields['Total Sent'] || 0,
        account.fields['Reply Rate Per Account %'] || 0,
        account.fields['Daily Limit'] || 0,
        `"${account.fields['Status'] || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `zero_reply_rate_accounts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [emailAccounts]);

  const fetchEmailAccounts = async (isRefresh = false) => {
    try {
      await refreshInfrastructure(isRefresh);
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    }
  };

  const generatePriceAnalysisData = (accounts) => {
    const fieldMap = {
      'Email Provider': 'Tag - Email Provider',
      'Reseller': 'Tag - Reseller', 
      'Client': 'Client Name (from Client)',
    };
    
    const field = fieldMap[selectedAnalysis];
    const groupedData = {};
    
    accounts.forEach(account => {
      const value = account.fields[field] || 'Unknown';
      const price = parseFloat(account.fields['Price']) || 0;
      
      if (!groupedData[value]) {
        groupedData[value] = {
          name: value,
          totalPrice: 0,
          count: 0,
          avgPrice: 0
        };
      }
      
      groupedData[value].totalPrice += price;
      groupedData[value].count += 1;
    });
    
    // Calculate average price and sort by total price
    const analysisData = Object.values(groupedData).map((item: any) => ({
      ...item,
      avgPrice: item.totalPrice / item.count
    })).sort((a: any, b: any) => b.totalPrice - a.totalPrice);
    
    setPriceAnalysisData(analysisData);
  };

  const generateClientAccountsData = (accounts) => {
    const clientGroups = {};
    
    accounts.forEach(account => {
      const clientName = account.fields['Client Name (from Client)']?.[0] || 'Unknown Client';
      
       if (!clientGroups[clientName]) {
         clientGroups[clientName] = {
           clientName,
           accounts: [],
           totalAccounts: 0,
           connectedAccounts: 0,
           totalPrice: 0,
           avgPrice: 0,
           maxSendingVolume: 0,
           currentAvailableSending: 0,
           zeroReplyRateCount: 0
         };
       }
       
       clientGroups[clientName].accounts.push(account);
       clientGroups[clientName].totalAccounts += 1;
       if (account.fields['Status'] === 'Connected') {
         clientGroups[clientName].connectedAccounts += 1;
       }
       
       // Check for 0% reply rate with 50+ emails sent
       const totalSent = parseFloat(account.fields['Total Sent']) || 0;
       const replyRateRaw = account.fields['Reply Rate Per Account %'];
       const replyRate = typeof replyRateRaw === 'number' ? replyRateRaw : parseFloat(replyRateRaw);
       
       if (totalSent > 50 && replyRate === 0) {
         clientGroups[clientName].zeroReplyRateCount += 1;
       }
       
       const price = parseFloat(account.fields['Price']) || 0;
       clientGroups[clientName].totalPrice += price;
       
       const volumePerAccount = parseFloat(account.fields['Volume Per Account']) || 0;
       clientGroups[clientName].maxSendingVolume += volumePerAccount;
       
       const dailyLimit = parseFloat(account.fields['Daily Limit']) || 0;
       clientGroups[clientName].currentAvailableSending += dailyLimit;
    });
    
     // Calculate averages and sort by total accounts
     const clientData = Object.values(clientGroups).map((client: any) => ({
       ...client,
       avgPrice: client.totalAccounts > 0 ? client.totalPrice / client.totalAccounts : 0,
       zeroReplyRatePercentage: client.totalAccounts > 0 ? ((client.zeroReplyRateCount / client.totalAccounts) * 100).toFixed(1) : 0
     })).sort((a: any, b: any) => b.totalAccounts - a.totalAccounts);
    
    setClientAccountsData(clientData);
  };

  const generateEmailProviderData = (accounts) => {
    const providerGroups = {};
    
    accounts.forEach(account => {
      // Use Tag - Email Provider field specifically
      const provider = account.fields['Tag - Email Provider'] || 'Unknown';
      const totalSent = parseFloat(account.fields['Total Sent']) || 0;
      const rrRaw = account.fields['Reply Rate Per Account %'];
      const replyRateRaw = typeof rrRaw === 'number' ? rrRaw : parseFloat(rrRaw);
      
      // Initialize provider group if it doesn't exist
      if (!providerGroups[provider]) {
        providerGroups[provider] = {
          name: provider,
          accounts: [],
          totalDailyLimit: 0,           // Sum of Volume Per Account (calculated limits)
          currentDailyLimit: 0,         // Sum of Daily Limit from Email Bison (warmup status)
          totalSent: 0,                 // All emails sent (all accounts)
          totalReplies: 0,              // All replies (all accounts)
          totalRepliesQualifying: 0,    // Sum of replies from accounts with ≥50 sent
          totalSentQualifying: 0,       // Sum of sent from accounts with ≥50 sent
          qualifyingAccountCount: 0,    // Count of accounts with ≥50 sent
          totalAccountCount: 0,         // Total account count
          avgReplyRate: 0
        };
      }
      
      // Track for ALL accounts
      providerGroups[provider].totalAccountCount += 1;
      providerGroups[provider].accounts.push(account);

      // Track daily limits
      const dailyLimit = parseFloat(account.fields['Daily Limit']) || 0; // Current Email Bison limit
      const volumePerAccount = parseFloat(account.fields['Volume Per Account']) || 0; // Calculated theoretical limit
      providerGroups[provider].currentDailyLimit += dailyLimit;
      providerGroups[provider].totalDailyLimit += volumePerAccount;

      // Track emails sent and replies (for "Total Email Sent" view)
      const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
      providerGroups[provider].totalSent += totalSent;
      providerGroups[provider].totalReplies += totalReplied;

      // Track raw totals for weighted reply rate calculation (accounts with ≥50 sent)
      if (totalSent >= 50) {
        providerGroups[provider].totalRepliesQualifying += totalReplied;
        providerGroups[provider].totalSentQualifying += totalSent;
        providerGroups[provider].qualifyingAccountCount += 1;
      }
    });
    
    // Calculate metrics and sort by selected view
    const providerData = Object.values(providerGroups).map((provider: any) => {
      // Calculate weighted reply rate for accounts with ≥50 sent
      let avgReplyRate = 0;
      if (provider.totalSentQualifying > 0) {
        avgReplyRate = (provider.totalRepliesQualifying / provider.totalSentQualifying) * 100;
        avgReplyRate = Math.round(avgReplyRate * 10) / 10; // Round to 1 decimal
      }

      // Calculate overall reply rate (all accounts)
      let overallReplyRate = 0;
      if (provider.totalSent > 0) {
        overallReplyRate = (provider.totalReplies / provider.totalSent) * 100;
      }

      // Calculate warmup/utilization rate
      let utilizationRate = 0;
      if (provider.totalDailyLimit > 0) {
        utilizationRate = (provider.currentDailyLimit / provider.totalDailyLimit) * 100;
      }

      return {
        ...provider,
        avgReplyRate,
        overallReplyRate,
        utilizationRate,
        hasData: provider.accounts.length > 0 // Show all providers that have accounts
      };
    }).filter(provider => provider.hasData);
    
    // Sort based on selected view (highest to lowest)
    let sortedData;
    switch (selectedProviderView) {
      case 'Total Email Sent':
        sortedData = providerData.sort((a, b) => b.totalSent - a.totalSent);
        break;
      case 'Accounts 50+':
        sortedData = providerData.sort((a, b) => b.avgReplyRate - a.avgReplyRate);
        break;
      case 'Daily Availability':
        sortedData = providerData.sort((a, b) => b.totalDailyLimit - a.totalDailyLimit);
        break;
      default:
        sortedData = providerData.sort((a, b) => b.totalSent - a.totalSent);
    }
    
    setEmailProviderData(sortedData);
  };

  const downloadFailedAccounts = () => {
    // Show confirmation dialog
    const confirmDownload = window.confirm(
      'Do you want to download all disconnected/failed accounts? This will include accounts with status: Failed, Not connected, or Disconnected.'
    );
    
    if (!confirmDownload) {
      return;
    }
    
    // Filter accounts with Failed or Not connected status
    const failedAccounts = emailAccounts.filter(account => {
      const status = account.fields['Status'];
      return status === 'Failed' || status === 'Not connected' || status === 'Disconnected';
    });

    if (failedAccounts.length === 0) {
      alert('No failed or disconnected accounts found.');
      return;
    }

    // Create CSV content
    const headers = [
      'Email Account',
      'Tag - Reseller', 
      'Tag - Email Provider',
      'Name',
      'Status',
      'Client Name',
      'Domain',
      'Account Type',
      'Workspace',
      'Total Sent',
      'Total Replied',
      'Total Bounced',
      'Daily Limit',
      'Price'
    ];

    const csvContent = [
      headers.join(','),
      ...failedAccounts.map(account => [
        `"${account.fields['Email Account'] || ''}"`,
        `"${account.fields['Tag - Reseller'] || ''}"`,
        `"${account.fields['Tag - Email Provider'] || ''}"`,
        `"${account.fields['Name'] || ''}"`,
        `"${account.fields['Status'] || ''}"`,
        `"${account.fields['Client Name (from Client)']?.[0] || ''}"`,
        `"${account.fields['Domain'] || ''}"`,
        `"${account.fields['Account Type'] || account.fields['Accounts Type'] || ''}"`,
        `"${account.fields['Workspace'] || ''}"`,
        account.fields['Total Sent'] || 0,
        account.fields['Total Replied'] || 0,
        account.fields['Total Bounced'] || 0,
        account.fields['Daily Limit'] || 0,
        account.fields['Price'] || 0
      ].join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `failed_accounts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateClientSendingData = (accounts) => {
    const clientGroups = {};
    
    accounts.forEach(account => {
      const clientName = account.fields['Client Name (from Client)']?.[0] || 'Unknown Client';
      
      if (!clientGroups[clientName]) {
        clientGroups[clientName] = {
          clientName,
          maxSending: 0, // Sum of Volume Per Account
          availableSending: 0, // Sum of Daily Limit
          dailyVolumeTargets: [], // Array for median calculation
          accountCount: 0
        };
      }
      
      const volumePerAccount = parseFloat(account.fields['Volume Per Account']) || 0;
      const dailyLimit = parseFloat(account.fields['Daily Limit']) || 0;
      const dailyVolumeTarget = parseFloat(account.fields['Clients Daily Volume Target']) || 0;
      
      clientGroups[clientName].maxSending += volumePerAccount;
      clientGroups[clientName].availableSending += dailyLimit;
      clientGroups[clientName].accountCount += 1;
      
      if (dailyVolumeTarget > 0) {
        clientGroups[clientName].dailyVolumeTargets.push(dailyVolumeTarget);
      }
    });
    
    // Calculate metrics for each client
    const clientData = Object.values(clientGroups).map((client: any) => {
      // Calculate median daily volume target
      const targets = client.dailyVolumeTargets.sort((a, b) => a - b);
      const median = targets.length > 0 
        ? targets.length % 2 === 0 
          ? (targets[targets.length / 2 - 1] + targets[targets.length / 2]) / 2
          : targets[Math.floor(targets.length / 2)]
        : 0;
      
      // Calculate percentage of available vs maximum
      const utilizationPercentage = client.maxSending > 0 
        ? Math.round((client.availableSending / client.maxSending) * 100)
        : 0;
      
      return {
        ...client,
        medianDailyTarget: median,
        utilizationPercentage,
        shortfall: client.maxSending - client.availableSending,
        shortfallPercentage: client.maxSending > 0 
          ? Math.round(((client.maxSending - client.availableSending) / client.maxSending) * 100)
          : 0
      };
    }).filter(client => client.accountCount > 0)
      .sort((a, b) => b.maxSending - a.maxSending); // Sort by max sending capacity
    
    setClientSendingData(clientData);
  };

  const openClientModal = useCallback((client: any) => {
    setInfrastructureSelectedClient(client);
    setInfrastructureModalOpen(true);
    setInfrastructureExpandedAccountTypes(new Set());
    setInfrastructureExpandedStatuses(new Set());
    setInfrastructureFilter('clientAccountFilter', null);
  }, [setInfrastructureSelectedClient, setInfrastructureModalOpen, setInfrastructureExpandedAccountTypes, setInfrastructureExpandedStatuses, setInfrastructureFilter]);

  const openClientModalWithFilter = useCallback((client: any, filter: string) => {
    setInfrastructureSelectedClient(client);
    setInfrastructureModalOpen(true);
    setInfrastructureExpandedAccountTypes(new Set());
    setInfrastructureExpandedStatuses(new Set());
    setInfrastructureFilter('clientAccountFilter', filter);
  }, [setInfrastructureSelectedClient, setInfrastructureModalOpen, setInfrastructureExpandedAccountTypes, setInfrastructureExpandedStatuses, setInfrastructureFilter]);

  const closeClientModal = useCallback(() => {
    setInfrastructureModalOpen(false);
    setInfrastructureSelectedClient(null);
    setInfrastructureFilter('clientAccountFilter', null);
  }, [setInfrastructureModalOpen, setInfrastructureSelectedClient, setInfrastructureFilter]);

  const toggleAccountType = useCallback((accountType: string) => {
    setInfrastructureExpandedAccountTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountType)) {
        newSet.delete(accountType);
      } else {
        newSet.add(accountType);
      }
      return newSet;
    });
  }, [setInfrastructureExpandedAccountTypes]);

  const toggleStatus = useCallback((statusKey: string) => {
    setInfrastructureExpandedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(statusKey)) {
        newSet.delete(statusKey);
      } else {
        newSet.add(statusKey);
      }
      return newSet;
    });
  }, [setInfrastructureExpandedStatuses]);

  // Fetch data on mount and cleanup old cache
  useEffect(() => {
    // Clear any old cached data to free up space
    const oldCacheKeys = [
      'email-accounts-data',
      'email-accounts-timestamp',
      'email-accounts-data-v2',
      'email-accounts-timestamp-v2',
      'email-accounts-data-v2-fixed',
      'email-accounts-timestamp-v2-fixed',
      'email-accounts-data-v2-longrun',
      'email-accounts-timestamp-v2-longrun',
      'email-accounts-data-v2-scaledmail',
      'email-accounts-timestamp-v2-scaledmail'
    ];
    oldCacheKeys.forEach(key => localStorage.removeItem(key));

    fetchEmailAccounts();
  }, []);

  useEffect(() => {
    if (emailAccounts.length > 0) {
      generatePriceAnalysisData(emailAccounts);
    }
  }, [selectedAnalysis, emailAccounts]);

  useEffect(() => {
    if (emailAccounts.length > 0) {
      generateEmailProviderData(emailAccounts);
    }
  }, [selectedProviderView, emailAccounts]);

  useEffect(() => {
    if (emailAccounts.length > 0) {
      generateClientSendingData(emailAccounts);
    }
  }, [emailAccounts]);

  // Process email accounts data whenever it changes from context
  useEffect(() => {
    if (emailAccounts.length === 0) return; // Skip if no data

    const accounts = emailAccounts;

    // Calculate metrics
    const totalAccounts = accounts.length;

    // Count unique clients
    const uniqueClients = new Set(
      accounts.map(account => {
        const clientField = account.fields['Client'];
        return clientField && clientField.length > 0 ? clientField[0] : 'Unknown';
      })
    ).size;

    const avgAccountsPerClient = uniqueClients > 0 ? (totalAccounts / uniqueClients).toFixed(1) : '0';

    // Count connected vs disconnected
    const connectedCount = accounts.filter(account => account.fields['Status'] === 'Connected').length;
    const disconnectedCount = totalAccounts - connectedCount;

    // Calculate price metrics
    const totalPrice = accounts.reduce((sum, account) => {
      const price = parseFloat(account.fields['Price']) || 0;
      return sum + price;
    }, 0);

    const avgCostPerClient = uniqueClients > 0 ? (totalPrice / uniqueClients).toFixed(2) : '0';

    // Debug logging
    console.log('📊 Dashboard Stats Calculated:', {
      totalAccounts,
      uniqueClients,
      avgAccountsPerClient,
      connectedCount,
      disconnectedCount,
      totalPrice,
      avgCostPerClient
    });

    setAccountStats({
      total: totalAccounts,
      avgPerClient: avgAccountsPerClient,
      connected: connectedCount,
      disconnected: disconnectedCount,
      totalPrice: totalPrice,
      avgCostPerClient: avgCostPerClient
    });

    // Calculate reseller distribution
    const resellerCounts = {};
    accounts.forEach(account => {
      const reseller = account.fields['Tag - Reseller'] || 'Unknown';
      resellerCounts[reseller] = (resellerCounts[reseller] || 0) + 1;
    });

    const resellerChartData = Object.entries(resellerCounts).map(([name, count]) => ({
      name,
      value: count as number,
      percentage: (((count as number) / totalAccounts) * 100).toFixed(1)
    }));

    setResellerData(resellerChartData);

    // Calculate account type distribution
    const accountTypeCounts = {};
    accounts.forEach(account => {
      const accountType = account.fields['Account Type'] || 'Unknown';
      accountTypeCounts[accountType] = (accountTypeCounts[accountType] || 0) + 1;
    });

    const accountTypeChartData = Object.entries(accountTypeCounts).map(([name, count]) => ({
      name,
      value: count as number,
      percentage: (((count as number) / totalAccounts) * 100).toFixed(1)
    }));

    setAccountTypeData(accountTypeChartData);
  }, [emailAccounts]);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" size="sm" className="hover:bg-accent">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
              <div className="h-6 w-px bg-border"></div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Sending Accounts Infrastructure
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Email Infrastructure Management & Monitoring
                    {lastUpdated && (
                      <span className="ml-2">
                        • Updated {formatLastUpdated()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-success/10 text-success border-success/40">
                <Activity className="h-3 w-3 mr-1" />
                All Systems Operational
              </Badge>
              <Button
                onClick={() => fetchEmailAccounts(true)}
                disabled={loading}
                variant="ghost"
                size="sm"
                className="hover:bg-accent"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
               <Button 
                onClick={downloadFailedAccounts}
                disabled={loading}
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 font-medium px-3 py-2 transition-all"
               >
                 <Download className="h-3 w-3 mr-2" />
                 Failed Accounts
               </Button>
               <Button 
                onClick={downloadZeroReplyRateAccounts}
                disabled={loading}
                size="sm"
                variant="outline"
                className="border-warning/40 text-warning hover:bg-warning/10 font-medium px-3 py-2 transition-all"
               >
                 <Download className="h-3 w-3 mr-2" />
                 0% Reply Rate (50+)
               </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Overview - 4 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Email Accounts Owned */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Mail className="h-6 w-6 text-dashboard-primary" />
                <Badge variant="outline" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{loading ? '...' : accountStats.total}</div>
              <p className="text-white/70 text-sm">{loading ? loadingMessage : 'Total Email Accounts Owned'}</p>
            </CardContent>
          </Card>

          {/* Card 2: Average Email Accounts per Client */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Users className="h-6 w-6 text-dashboard-accent" />
                <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                  Balanced
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{loading ? '...' : accountStats.avgPerClient}</div>
              <p className="text-white/70 text-sm">Avg Accounts per Client</p>
            </CardContent>
          </Card>

          {/* Card 3: Total Accounts Value */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <DollarSign className="h-6 w-6 text-dashboard-primary" />
                <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                  Value
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">
                ${loading ? '...' : accountStats.totalPrice.toFixed(2)}
              </div>
              <p className="text-white/70 text-sm">Total Accounts Value</p>
            </CardContent>
          </Card>

          {/* Card 4: Average Cost per Client */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <DollarSign className="h-6 w-6 text-dashboard-accent" />
                <Badge variant="outline" className="bg-dashboard-accent/20 text-dashboard-accent border-dashboard-accent/40">
                  Average
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">
                ${loading ? '...' : accountStats.avgCostPerClient}
              </div>
              <p className="text-white/70 text-sm">Avg Cost per Client</p>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Per Client Bar Chart */}
        <div className="mt-8 mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="h-5 w-5 text-dashboard-primary" />
                <span>Total Accounts Per Client</span>
              </CardTitle>
              <p className="text-white/60 text-sm mt-1">
                Distribution of email accounts across all clients
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-white/70">Loading client data...</div>
                </div>
              ) : (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        const clientCounts: { [key: string]: number } = {};
                        emailAccounts.forEach(account => {
                          const clientName = account.fields['Client Name (from Client)']?.[0] || 'Unknown Client';
                          clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;
                        });
                        
                        const sortedData = Object.entries(clientCounts)
                          .map(([name, count]) => ({ name, count: count as number }))
                          .sort((a, b) => b.count - a.count); // Show ALL clients
                        
                        // Add ranking and colors
                        return sortedData.map((item, index) => ({
                          ...item,
                          rank: index + 1,
                          fill: index < 3 ? '#10B981' : // Top 3 - bright green
                                index >= sortedData.length - 3 ? '#6B7280' : // Bottom 3 - gray
                                '#3B82F6', // Middle - blue
                          isTop3: index < 3
                        }));
                      })()}
                      margin={{ top: 40, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="name" 
                        stroke="rgba(255,255,255,0.7)"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        fontSize={11}
                      />
                      <YAxis stroke="rgba(255,255,255,0.7)" />
                      <Bar 
                        dataKey="count" 
                        radius={[4, 4, 0, 0]}
                        label={{
                          position: 'top',
                          fill: 'white',
                          fontSize: 12,
                          fontWeight: 'bold'
                        }}
                      >
                        {(() => {
                          const clientCounts: { [key: string]: number } = {};
                          emailAccounts.forEach(account => {
                            const clientName = account.fields['Client Name (from Client)']?.[0] || 'Unknown Client';
                            clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;
                          });
                          
                          const sortedData = Object.entries(clientCounts)
                            .map(([name, count]) => ({ name, count: count as number }))
                            .sort((a, b) => b.count - a.count); // Show ALL clients
                          
                          return sortedData.map((item, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={index < 3 ? '#10B981' : // Top 3 - bright green
                                    index >= sortedData.length - 3 ? '#6B7280' : // Bottom 3 - gray
                                    '#3B82F6'} // Middle - blue
                            />
                          ));
                        })()}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  
                  {/* Top 3 Legend */}
                  <div className="mt-1"></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Connection Status & Provider Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Connection Status Chart */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-dashboard-success" />
                <span>Account Connection Status Breakdown</span>
              </CardTitle>
              <p className="text-white/60 text-sm mt-1">
                Visual representation of connected accounts. The closer to 100%, the better.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-white/70">Loading chart data...</div>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="relative h-64 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Connected', value: accountStats.connected, color: 'hsl(var(--dashboard-success))' },
                            { name: 'Disconnected', value: accountStats.disconnected, color: 'hsl(var(--dashboard-warning))' }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                        >
                          {[
                            { name: 'Connected', value: accountStats.connected, color: 'hsl(var(--dashboard-success))' },
                            { name: 'Disconnected', value: accountStats.disconnected, color: 'hsl(var(--dashboard-warning))' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Center Text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">
                          {((accountStats.connected / accountStats.total) * 100).toFixed(1)}%
                        </div>
                        <div className="text-white/70 text-sm">Connected</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 rounded-full bg-dashboard-success"></div>
                      <div className="text-white text-sm">
                        <div className="font-medium">Connected</div>
                        <div className="text-white/70">{accountStats.connected} accounts</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 rounded-full bg-dashboard-warning"></div>
                      <div className="text-white text-sm">
                        <div className="font-medium">Disconnected</div>
                        <div className="text-white/70">{accountStats.disconnected} accounts</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workspace Distribution */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="h-5 w-5 text-dashboard-primary" />
                <span>Workspace Accounts Distribution Breakdown</span>
              </CardTitle>
              <p className="text-white/60 text-sm mt-1">
                Visual representation of how many accounts each workspace owns.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-white/70">Loading chart data...</div>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="relative h-64 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            const maverickCount = emailAccounts.filter(account =>
                              account.fields['Bison Instance'] === 'Maverick'
                            ).length;
                            const longrunCount = emailAccounts.filter(account =>
                              account.fields['Bison Instance'] === 'Long Run'
                            ).length;

                            return [
                              { name: 'Maverick', value: maverickCount, color: '#8B5CF6' },
                              { name: 'Long Run', value: longrunCount, color: '#F59E0B' }
                            ];
                          })()}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                        >
                          {(() => {
                            const maverickCount = emailAccounts.filter(account =>
                              account.fields['Bison Instance'] === 'Maverick'
                            ).length;
                            const longrunCount = emailAccounts.filter(account =>
                              account.fields['Bison Instance'] === 'Long Run'
                            ).length;

                            return [
                              { name: 'Maverick', value: maverickCount, color: '#8B5CF6' },
                              { name: 'Long Run', value: longrunCount, color: '#F59E0B' }
                            ];
                          })().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Center Text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">
                          {emailAccounts.length}
                        </div>
                        <div className="text-white/70 text-sm">
                          Total Accounts
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#8B5CF6' }}></div>
                      <div className="text-white text-sm">
                        <div className="font-medium">Maverick Bison</div>
                        <div className="text-white/70">
                          {emailAccounts.filter(account => account.fields['Bison Instance'] === 'Maverick').length} accounts
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#F59E0B' }}></div>
                      <div className="text-white text-sm">
                        <div className="font-medium">Long Run Bison</div>
                        <div className="text-white/70">
                          {emailAccounts.filter(account => account.fields['Bison Instance'] === 'Long Run').length} accounts
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Simplified Price Analysis */}
        <div className="mt-8">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Activity className="h-5 w-5 text-dashboard-primary" />
                <span>Price Analysis</span>
              </CardTitle>
              <div className="flex items-center space-x-4 mt-4">
                <label className="text-white/70 text-sm">Analyze by:</label>
                <Select value={selectedAnalysis} onValueChange={(value) => setInfrastructureFilter('selectedAnalysis', value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email Provider">Email Provider</SelectItem>
                    <SelectItem value="Reseller">Reseller</SelectItem>
                    <SelectItem value="Client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-white/70">Loading analysis...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <div className="h-80">
                    <h3 className="text-white/90 text-lg font-semibold mb-4">Total Price by {selectedAnalysis}</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priceAnalysisData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="name" 
                          stroke="rgba(255,255,255,0.7)"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          interval={0}
                          fontSize={11}
                        />
                        <YAxis stroke="rgba(255,255,255,0.7)" />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: 'white'
                          }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Total Price']}
                        />
                        <Bar 
                          dataKey="totalPrice" 
                          fill="hsl(var(--dashboard-primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Summary Table */}
                  <div className="h-80 overflow-y-auto">
                    <h3 className="text-white/90 text-lg font-semibold mb-4">Summary by {selectedAnalysis}</h3>
                    <div className="space-y-3">
                      {priceAnalysisData.map((item: any, index) => (
                        <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-white font-medium truncate">{item.name}</h4>
                            <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40 ml-2">
                              {item.count} accounts
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-white/70">Total Value:</span>
                              <div className="text-white font-semibold">${item.totalPrice.toFixed(2)}</div>
                            </div>
                            <div>
                              <span className="text-white/70">Avg per Account:</span>
                              <div className="text-white font-semibold">${item.avgPrice.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Email Provider Performance Analysis */}
        <div className="mt-8">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Mail className="h-5 w-5 text-dashboard-primary" />
                <span>Email Provider Performance</span>
              </CardTitle>
              <div className="flex items-center space-x-4 mt-4">
                <label className="text-white/70 text-sm">Show:</label>
                <Select value={selectedProviderView} onValueChange={(value) => setInfrastructureFilter('selectedProviderView', value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Total Email Sent">Total Email Sent by Provider</SelectItem>
                    <SelectItem value="Accounts 50+">Accounts with ≥50 Emails Sent</SelectItem>
                    <SelectItem value="Daily Availability">Daily Sending Availability</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-white/70">Loading provider analysis...</div>
                </div>
              ) : (
                emailProviderData.length === 0 ? (
                  <div className="h-96 flex items-center justify-center">
                    <div className="text-white/70">No Data Available</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {emailProviderData.map((provider: any, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-white font-medium text-lg">{provider.name}</h4>
                          <Badge variant="outline" className="bg-dashboard-accent/20 text-dashboard-accent border-dashboard-accent/40 ml-2">
                            {selectedProviderView === 'Accounts 50+'
                              ? provider.qualifyingAccountCount
                              : provider.totalAccountCount} accounts
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-sm">

                          {/* MODE 1: Total Email Sent by Provider */}
                          {selectedProviderView === 'Total Email Sent' && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-white/70">Total Sent:</span>
                                <div className="text-white font-semibold">{provider.totalSent.toLocaleString()}</div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/70">Total Replies:</span>
                                <div className="text-white font-semibold">{provider.totalReplies.toLocaleString()}</div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/70">Reply Rate:</span>
                                <div className="text-white font-semibold">{provider.overallReplyRate.toFixed(2)}%</div>
                              </div>
                            </>
                          )}

                          {/* MODE 2: Accounts with ≥50 Emails Sent */}
                          {selectedProviderView === 'Accounts 50+' && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-white/70">Total Sent (≥50):</span>
                                <div className="text-white font-semibold">{provider.totalSentQualifying.toLocaleString()}</div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/70">Total Replies (≥50):</span>
                                <div className="text-white font-semibold">{provider.totalRepliesQualifying.toLocaleString()}</div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/70">Avg Reply Rate:</span>
                                <div className="text-white font-semibold">{provider.avgReplyRate.toFixed(2)}%</div>
                              </div>
                            </>
                          )}

                          {/* MODE 3: Daily Sending Availability */}
                          {selectedProviderView === 'Daily Availability' && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-white/70">Theoretical Limit:</span>
                                <div className="text-white font-semibold">{provider.totalDailyLimit.toLocaleString()}/day</div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/70">Current Limit:</span>
                                <div className="text-white font-semibold">{provider.currentDailyLimit.toLocaleString()}/day</div>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/70">Warmup Progress:</span>
                                <div className="text-white font-semibold">{provider.utilizationRate.toFixed(1)}%</div>
                              </div>
                            </>
                          )}

                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Client Sending Capacity Comparison */}
        <div className="mt-8">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="h-5 w-5 text-dashboard-accent" />
                <span>Client Sending Capacity Analysis</span>
              </CardTitle>
              <div className="flex items-center justify-between mt-4">
                <p className="text-white/60 text-sm">Compare maximum sending capacity vs available sending per client</p>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInfrastructureFilter('selectedClientForSending', 'Insufficient Capacity')}
                    className={`border-dashboard-warning/40 text-dashboard-warning hover:bg-dashboard-warning/10 ${
                      selectedClientForSending === 'Insufficient Capacity' ? 'bg-dashboard-warning/20' : ''
                    }`}
                  >
                    Show Insufficient Capacity
                  </Button>
                  <Select value={selectedClientForSending} onValueChange={(value) => setInfrastructureFilter('selectedClientForSending', value)}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Clients">All Clients</SelectItem>
                      {clientSendingData.map((client, index) => (
                        <SelectItem key={index} value={client.clientName}>
                          {client.clientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-white/70">Loading capacity analysis...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(() => {
                    let displayData;
                    if (selectedClientForSending === 'All Clients') {
                      displayData = clientSendingData.slice(0, 6); // Show top 6 clients
                    } else if (selectedClientForSending === 'Insufficient Capacity') {
                      displayData = clientSendingData.filter(client => client.medianDailyTarget > client.availableSending);
                    } else {
                      displayData = clientSendingData.filter(client => client.clientName === selectedClientForSending);
                    }
                    
                    return displayData.map((client: any, index) => (
                      <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-white font-medium text-sm">{client.clientName}</h4>
                          <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                            {client.accountCount} accounts
                          </Badge>
                        </div>
                        
                        {/* Capacity Bar Chart */}
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/70">Maximum Capacity</span>
                            <span className="text-white font-semibold">{client.maxSending.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div 
                              className="bg-dashboard-success h-2 rounded-full" 
                              style={{ width: '100%' }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between text-xs">
                            <span className="text-white/70">Available Sending</span>
                            <span className="text-white font-semibold">{client.availableSending.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div 
                              className="bg-dashboard-accent h-2 rounded-full" 
                              style={{ width: `${client.utilizationPercentage}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between text-xs">
                            <span className="text-white/70">Daily Target</span>
                            <span className={`font-semibold ${
                              client.medianDailyTarget > client.availableSending 
                                ? 'text-dashboard-warning' 
                                : 'text-dashboard-success'
                            }`}>
                              {client.medianDailyTarget.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                client.medianDailyTarget > client.availableSending 
                                  ? 'bg-dashboard-warning' 
                                  : 'bg-dashboard-success'
                              }`}
                              style={{ 
                                width: `${Math.min((client.medianDailyTarget / client.maxSending) * 100, 100)}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-white/70">Utilization:</span>
                            <div className="text-white font-semibold">{client.utilizationPercentage}%</div>
                          </div>
                          <div>
                            <span className="text-white/70">Shortfall:</span>
                            <div className="text-dashboard-warning font-semibold">{client.shortfallPercentage}%</div>
                          </div>
                          <div>
                            <span className="text-white/70">Daily Target:</span>
                            <div className="text-white font-semibold">{client.medianDailyTarget.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-white/70">Gap:</span>
                            <div className="text-dashboard-warning font-semibold">{client.shortfall.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Client Accounts View */}
        <div className="mt-8">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="h-5 w-5 text-dashboard-accent" />
                <span>Client Email Accounts</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-white/70">Loading client data...</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {clientAccountsData.map((client: any, index) => (
                    <div 
                      key={index}
                      onClick={() => openClientModal(client)}
                      className="bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <ChevronRight className="h-4 w-4 text-white/70" />
                          <div>
                            <h3 className="text-white font-medium text-sm">{client.clientName}</h3>
                            <p className="text-white/60 text-xs">{client.totalAccounts} accounts</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-white font-medium text-sm">${client.totalPrice.toFixed(2)}</div>
                            <div className="text-white/60 text-xs">Total Value</div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-medium text-sm">{client.maxSendingVolume.toLocaleString()}</div>
                            <div className="text-white/60 text-xs">Max Volume</div>
                          </div>
                           <div className="text-right">
                             <div className="text-white font-medium text-sm">{client.currentAvailableSending.toLocaleString()}</div>
                             <div className="text-white/60 text-xs">Daily Limit</div>
                           </div>
                           <div 
                             className="text-right cursor-pointer hover:bg-white/10 rounded px-2 py-1 transition-colors"
                             onClick={(e) => {
                               e.stopPropagation();
                               openClientModalWithFilter(client, 'zeroReplyRate');
                             }}
                           >
                             <div className={`text-white font-medium text-sm ${parseFloat(client.zeroReplyRatePercentage) > 0 ? 'text-dashboard-warning' : 'text-dashboard-success'}`}>
                               {client.zeroReplyRatePercentage}%
                             </div>
                             <div className="text-white/60 text-xs">0% Reply Rate</div>
                           </div>
                          <Badge variant="outline" className={`text-xs ${
                            client.connectedAccounts === client.totalAccounts 
                              ? 'bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40'
                              : 'bg-dashboard-warning/20 text-dashboard-warning border-dashboard-warning/40'
                          }`}>
                            {client.connectedAccounts}/{client.totalAccounts}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Client Detail Modal */}
        <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden bg-gray-900 border-white/20 flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-white flex items-center space-x-2">
                <Users className="h-5 w-5 text-dashboard-accent" />
                <span>{selectedClient?.clientName} - Email Accounts</span>
                {clientAccountFilter === 'zeroReplyRate' && (
                  <Badge variant="outline" className="bg-dashboard-warning/20 text-dashboard-warning border-dashboard-warning/40 ml-2">
                    0% Reply Rate Filter
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              {selectedClient && (
                <ClientAccountsModal 
                  client={selectedClient}
                  expandedAccountTypes={expandedAccountTypes}
                  expandedStatuses={expandedStatuses}
                  toggleAccountType={toggleAccountType}
                  toggleStatus={toggleStatus}
                  filter={clientAccountFilter}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

// Separate component for better performance
const ClientAccountsModal = ({ client, expandedAccountTypes, expandedStatuses, toggleAccountType, toggleStatus, filter }) => {
  const organizedAccounts = useMemo(() => {
    const accountsByType = {};
    
    // Apply filter if specified
    let accountsToProcess = client.accounts;
    if (filter === 'zeroReplyRate') {
      accountsToProcess = client.accounts.filter(account => {
        const totalSent = parseFloat(account.fields['Total Sent']) || 0;
        const replyRateRaw = account.fields['Reply Rate Per Account %'];
        const replyRate = typeof replyRateRaw === 'number' ? replyRateRaw : parseFloat(replyRateRaw);
        return totalSent > 50 && replyRate === 0;
      });
    }
    
    accountsToProcess.forEach(account => {
      const accountType = account.fields['Account Type'] || 'Unknown';
      if (!accountsByType[accountType]) {
        accountsByType[accountType] = {
          Connected: [],
          Disconnected: []
        };
      }
      
      const status = account.fields['Status'] === 'Connected' ? 'Connected' : 'Disconnected';
      accountsByType[accountType][status].push(account);
    });
    
    return accountsByType;
  }, [client.accounts, filter]);

  return (
    <div className="space-y-3">
      {Object.entries(organizedAccounts).map(([accountType, statusGroups]) => (
        <Collapsible 
          key={accountType}
          open={expandedAccountTypes.has(accountType)}
          onOpenChange={() => toggleAccountType(accountType)}
        >
          <CollapsibleTrigger asChild>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {expandedAccountTypes.has(accountType) ? (
                    <ChevronDown className="h-4 w-4 text-white/70" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-white/70" />
                  )}
                  <span className="text-white font-medium">{accountType}</span>
                </div>
                <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                  {((statusGroups as any).Connected?.length || 0) + ((statusGroups as any).Disconnected?.length || 0)} accounts
                </Badge>
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="ml-4 mt-2 space-y-2">
              {Object.entries(statusGroups).map(([status, accounts]) => 
                accounts.length > 0 && (
                  <Collapsible 
                    key={`${accountType}-${status}`}
                    open={expandedStatuses.has(`${accountType}-${status}`)}
                    onOpenChange={() => toggleStatus(`${accountType}-${status}`)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="bg-white/5 rounded-lg p-2 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {expandedStatuses.has(`${accountType}-${status}`) ? (
                              <ChevronDown className="h-3 w-3 text-white/70" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-white/70" />
                            )}
                            <span className="text-white text-sm">{status}</span>
                          </div>
                          <Badge variant="outline" className={`text-xs ${
                            status === 'Connected'
                              ? 'bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40'
                              : 'bg-dashboard-warning/20 text-dashboard-warning border-dashboard-warning/40'
                          }`}>
                            {accounts.length} accounts
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 space-y-1">
                        {accounts.map((account, accountIndex) => (
                          <div key={accountIndex} className="bg-white/5 rounded-lg p-2 border border-white/10">
                            <div className="grid grid-cols-12 gap-2 items-center text-xs">
                              <div className="col-span-4">
                                <div className="flex items-center space-x-1">
                                  <Mail className="h-3 w-3 text-dashboard-primary" />
                                  <span className="text-white font-medium truncate">{account.fields['Email Account']}</span>
                                </div>
                                <div className="text-white/60 truncate">{account.fields['Name']}</div>
                              </div>
                              
                              <div className="col-span-2 text-white/70">
                                <div>{account.fields['Domain']}</div>
                                <div>{account.fields['Tag - Email Provider']}</div>
                              </div>
                              
                              <div className="col-span-2 text-white/70">
                                <div>Limit: {account.fields['Daily Limit'] || 'N/A'}</div>
                                <div>Vol: {account.fields['Volume Per Account'] || 'N/A'}</div>
                              </div>
                              
                              <div className="col-span-2 text-white/70">
                                <div>Sent: {account.fields['Total Sent'] || 0}</div>
                                <div>Replies: {account.fields['Total Replied'] || 0}</div>
                              </div>
                              
                              <div className="col-span-2 text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  <DollarSign className="h-3 w-3 text-dashboard-accent" />
                                  <span className="text-white font-semibold">
                                    ${parseFloat(account.fields['Price'] || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-white/60">
                                  Bounced: {account.fields['Total Bounced'] || 0}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
};

export default SendingAccountsInfrastructure;