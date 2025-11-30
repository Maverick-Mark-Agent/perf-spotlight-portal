import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Users, CheckCircle, XCircle, RefreshCw, Activity, ChevronDown, ChevronRight, DollarSign, Download, AlertTriangle, Info, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { supabase } from "@/integrations/supabase/client";
import { SyncProgressBar } from "@/components/SyncProgressBar";
import { TabNavigation, type TabValue } from "@/components/EmailInfrastructure/TabNavigation";
import { OverviewTab } from "@/components/EmailInfrastructure/OverviewTab";
import { PerformanceTab } from "@/components/EmailInfrastructure/PerformanceTab";
import { HomeInsuranceTab } from "@/components/EmailInfrastructure/HomeInsuranceTab";
import { InfraAssistantFAB, InfraAssistantSheet } from "@/components/EmailInfrastructure/assistant";
import { useInfraAssistant } from "@/hooks/useInfraAssistant";

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
  const [pollingJobStatus, setPollingJobStatus] = useState<any>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Global search state
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [expandedSearchAccount, setExpandedSearchAccount] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [noReplyAccountsData, setNoReplyAccountsData] = useState<{
    resellerStats: any[];
    espStats: any[];
    allAccounts: any[];
  }>({
    resellerStats: [],
    espStats: [],
    allAccounts: []
  });

  // ✅ NEW: Track active sync job for progress bar
  const [activeSyncJobId, setActiveSyncJobId] = useState<string | null>(null);

  // ✅ NEW: Tab navigation state
  const [activeTab, setActiveTab] = useState<TabValue>('overview');

  // ✅ NEW: AI Infrastructure Assistant
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const infraAssistant = useInfraAssistant();

  // ✅ NEW: Email Provider Performance section state
  const [providerPerformanceView, setProviderPerformanceView] = useState('reseller');
  const [resellerStatsData, setResellerStatsData] = useState([]);
  const [espStatsData, setEspStatsData] = useState([]);
  const [top100AccountsData, setTop100AccountsData] = useState([]);

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getDataFreshnessColor = () => {
    if (!lastUpdated) return 'text-gray-500';
    const now = new Date();
    const diffHours = (now.getTime() - lastUpdated.getTime()) / 3600000;

    if (diffHours < 6) return 'text-green-600'; // Fresh (< 6 hours)
    if (diffHours < 24) return 'text-yellow-600'; // Stale (6-24 hours)
    return 'text-red-600'; // Very stale (> 24 hours)
  };

  const getDataFreshnessMessage = () => {
    if (!lastUpdated) return 'No sync data available';
    const now = new Date();
    const diffHours = (now.getTime() - lastUpdated.getTime()) / 3600000;

    if (diffHours < 6) return 'Data is fresh and reliable';
    if (diffHours < 24) return 'Data may be slightly outdated';
    return 'Data is stale - manual refresh recommended';
  };

  const getNextSyncTime = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const diffMs = tomorrow.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    return `${diffHours}h ${diffMins}m`;
  };

  // Global search results - search across all accounts
  const globalSearchResults = useMemo(() => {
    if (!globalSearchTerm || globalSearchTerm.length < 2) return [];
    const term = globalSearchTerm.toLowerCase();
    return emailAccounts.filter(account =>
      account.fields?.Email?.toLowerCase().includes(term) ||
      account.fields?.Name?.toLowerCase().includes(term) ||
      account.fields?.Domain?.toLowerCase().includes(term) ||
      account.workspace_name?.toLowerCase().includes(term)
    ).slice(0, 50); // Limit to 50 results for performance
  }, [emailAccounts, globalSearchTerm]);

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

  const fetchEmailAccounts = useCallback(async (isRefresh = false) => {
    try {
      await refreshInfrastructure(isRefresh);
      await fetchPollingJobStatus();
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    }
  }, [refreshInfrastructure]);

  const fetchPollingJobStatus = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('polling_job_status')
        .select('*')
        .eq('job_name', 'poll-sender-emails')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching polling job status:', error);
        return;
      }

      setPollingJobStatus(data);
    } catch (error) {
      console.error('Error fetching polling job status:', error);
    }
  };

  const triggerManualRefresh = async () => {
    if (refreshCooldown > 0 || isManualRefreshing) {
      return;
    }

    try {
      setIsManualRefreshing(true);
      setLoadingMessage('Starting full email sync (this takes ~4 minutes)...');

      // ✅ Use the new orchestrator that handles batching automatically
      // This prevents EarlyDrop crashes by processing workspaces in smaller batches
      const { data, error } = await supabase.functions.invoke('trigger-full-email-sync');

      if (error) {
        console.error('Error triggering manual refresh:', error);
        alert('Failed to trigger refresh: ' + error.message);
        setIsManualRefreshing(false);
        return;
      }

      console.log('Full sync completed:', data);

      // Handle "another sync running" error
      if (data?.error?.includes('Another sync')) {
        alert('Another sync is already in progress. Please wait for it to complete.');
        setIsManualRefreshing(false);
        return;
      }

      // Show results
      if (data?.success) {
        alert(`✅ Sync complete!\n\n${data.total_accounts_synced} accounts synced across ${data.total_workspaces} workspaces\n(${data.successful_batches}/${data.total_batches} batches successful)`);
        // Refresh dashboard data
        await refreshInfrastructure(true);
      } else {
        alert(`⚠️ Sync completed with errors:\n${data?.error || 'Unknown error'}`);
      }

      setIsManualRefreshing(false);

      // Set cooldown (5 minutes)
      const COOLDOWN_SECONDS = 300; // 5 minutes
      setRefreshCooldown(COOLDOWN_SECONDS);

      // Start countdown timer
      const interval = setInterval(() => {
        setRefreshCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setLoadingMessage('');

    } catch (error) {
      console.error('Error during manual refresh:', error);
      alert('An error occurred during refresh: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsManualRefreshing(false);
      setActiveSyncJobId(null);
    }
  };

  // ✅ NEW: Handle sync completion from progress bar
  const handleSyncComplete = async () => {
    console.log('Sync completed! Refreshing dashboard...');
    setIsManualRefreshing(false);
    setActiveSyncJobId(null);
    setLoadingMessage('Fetching updated data...');

    // Refresh dashboard data
    await refreshInfrastructure(true);

    alert('Sync completed successfully! Dashboard has been refreshed with latest data.');
  };

  const formatCooldownTime = () => {
    if (refreshCooldown === 0) return '';
    const minutes = Math.floor(refreshCooldown / 60);
    const seconds = refreshCooldown % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
    
    // Debug: Check for Mailr accounts
    const mailrAccounts = accounts.filter(acc => {
      const esp = (acc.fields['Tag - Email Provider'] || '').toLowerCase();
      return esp.includes('mailr');
    });
    console.log(`📧 Email Provider Data: Found ${mailrAccounts.length} Mailr accounts out of ${accounts.length} total`);
    if (mailrAccounts.length > 0) {
      console.log('Sample Mailr account:', {
        email: mailrAccounts[0].fields['Email'] || mailrAccounts[0].fields['Email Account'],
        esp: mailrAccounts[0].fields['Tag - Email Provider'],
        totalSent: mailrAccounts[0].fields['Total Sent'],
        totalReplied: mailrAccounts[0].fields['Total Replied']
      });
    }
    
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
          noReplyAccountCount: 0,       // Count of accounts with 100+ sent, 0 replies
          totalSentNoReply: 0,          // Total sent from 100+ sent, 0 reply accounts
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

      // Track accounts with 100+ sent and 0 replies
      if (totalSent >= 100 && totalReplied === 0) {
        providerGroups[provider].noReplyAccountCount += 1;
        providerGroups[provider].totalSentNoReply += totalSent;
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
    
    // Debug: Log all provider names after filtering
    console.log('📊 Email Provider groups after filtering:', providerData.map(p => p.name).sort());
    const mailrProvider = providerData.find(p => p.name.toLowerCase().includes('mailr'));
    if (mailrProvider) {
      console.log(`✅ Mailr provider found: "${mailrProvider.name}" with ${mailrProvider.totalAccountCount} accounts, ${mailrProvider.noReplyAccountCount} with 100+ no replies`);
    } else {
      console.warn('⚠️ Mailr provider NOT found in emailProviderData after filtering');
    }
    
    // Sort based on selected view (highest to lowest)
    let sortedData;
    switch (selectedProviderView) {
      case 'Total Email Sent':
        sortedData = providerData.sort((a, b) => b.totalSent - a.totalSent);
        break;
      case 'Accounts 50+':
        sortedData = providerData.sort((a, b) => b.avgReplyRate - a.avgReplyRate);
        break;
      case '100+ No Replies':
        sortedData = providerData.sort((a, b) => b.noReplyAccountCount - a.noReplyAccountCount);
        break;
      case 'Daily Availability':
        sortedData = providerData.sort((a, b) => b.totalDailyLimit - a.totalDailyLimit);
        break;
      default:
        sortedData = providerData.sort((a, b) => b.totalSent - a.totalSent);
    }
    
    setEmailProviderData(sortedData);
  };

  // ✅ NEW: Generate Email Provider Performance data (Reseller, ESP, Top 100)
  const generateProviderPerformanceData = (accounts) => {
    const resellerGroups = {};
    const espGroups = {};

    // Debug: Log all unique ESP values to help identify Mailr
    const uniqueESPs = new Set<string>();
    accounts.forEach(account => {
      const esp = account.fields['Tag - Email Provider'] || 'Unknown';
      uniqueESPs.add(esp);
    });
    console.log('📊 All ESP values found:', Array.from(uniqueESPs).sort());
    const mailrVariations = Array.from(uniqueESPs).filter(esp => 
      esp.toLowerCase().includes('mailr') || esp.toLowerCase().includes('mailer')
    );
    if (mailrVariations.length > 0) {
      console.log('🔍 Mailr variations found:', mailrVariations);
    } else {
      console.warn('⚠️ No Mailr ESP found. Checking if Mailr accounts exist...');
      const mailrAccounts = accounts.filter(acc => {
        const email = (acc.fields['Email'] || acc.fields['Email Account'] || '').toLowerCase();
        const name = (acc.fields['Name'] || '').toLowerCase();
        return email.includes('mailr') || name.includes('mailr');
      });
      console.log(`Found ${mailrAccounts.length} accounts with "mailr" in email/name`);
      if (mailrAccounts.length > 0) {
        console.log('Sample Mailr account ESP value:', mailrAccounts[0].fields['Tag - Email Provider']);
      }
    }

    accounts.forEach(account => {
      const reseller = account.fields['Tag - Reseller'] || 'Unknown';
      const esp = account.fields['Tag - Email Provider'] || 'Unknown';
      const totalSent = parseFloat(account.fields['Total Sent']) || 0;
      const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
      const bounced = parseFloat(account.fields['Bounced']) || 0;

      // Calculate individual account bounce rate
      const accountBounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;

      // GROUP BY RESELLER
      if (!resellerGroups[reseller]) {
        resellerGroups[reseller] = {
          name: reseller,
          accounts: [],
          totalAccounts: 0,
          totalSent: 0,
          totalReplies: 0,
          totalBounces: 0,
          bounceRateSum: 0, // For calculating average bounce rate per account
        };
      }

      resellerGroups[reseller].accounts.push(account);
      resellerGroups[reseller].totalAccounts += 1;
      resellerGroups[reseller].totalSent += totalSent;
      resellerGroups[reseller].totalReplies += totalReplied;
      resellerGroups[reseller].totalBounces += bounced;
      resellerGroups[reseller].bounceRateSum += accountBounceRate;

      // GROUP BY ESP (same logic)
      if (!espGroups[esp]) {
        espGroups[esp] = {
          name: esp,
          accounts: [],
          totalAccounts: 0,
          totalSent: 0,
          totalReplies: 0,
          totalBounces: 0,
          bounceRateSum: 0,
        };
      }

      espGroups[esp].accounts.push(account);
      espGroups[esp].totalAccounts += 1;
      espGroups[esp].totalSent += totalSent;
      espGroups[esp].totalReplies += totalReplied;
      espGroups[esp].totalBounces += bounced;
      espGroups[esp].bounceRateSum += accountBounceRate;
    });

    // Calculate final metrics for each reseller
    const resellerStats = Object.values(resellerGroups).map(group => ({
      ...group,
      replyRate: group.totalSent > 0 ? ((group.totalReplies / group.totalSent) * 100).toFixed(2) : '0.00',
      groupBounceRate: group.totalSent > 0 ? ((group.totalBounces / group.totalSent) * 100).toFixed(2) : '0.00',
      avgBounceRatePerAccount: group.totalAccounts > 0 ? (group.bounceRateSum / group.totalAccounts).toFixed(2) : '0.00',
    }));

    // Calculate final metrics for each ESP
    const espStats = Object.values(espGroups).map(group => ({
      ...group,
      replyRate: group.totalSent > 0 ? ((group.totalReplies / group.totalSent) * 100).toFixed(2) : '0.00',
      groupBounceRate: group.totalSent > 0 ? ((group.totalBounces / group.totalSent) * 100).toFixed(2) : '0.00',
      avgBounceRatePerAccount: group.totalAccounts > 0 ? (group.bounceRateSum / group.totalAccounts).toFixed(2) : '0.00',
    }));

    // TOP 100 PERFORMERS (50+ sent, sorted by reply rate)
    const top100 = accounts
      .filter(account => parseFloat(account.fields['Total Sent']) >= 50)
      .map(account => {
        const totalSent = parseFloat(account.fields['Total Sent']) || 0;
        const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
        const replyRate = totalSent > 0 ? (totalReplied / totalSent * 100) : 0;
        return { ...account, calculatedReplyRate: replyRate };
      })
      .sort((a, b) => b.calculatedReplyRate - a.calculatedReplyRate)
      .slice(0, 100);

    setResellerStatsData(resellerStats);
    setEspStatsData(espStats);
    setTop100AccountsData(top100);

    // Generate 150+ No Replies data (filtered accounts with 150+ sent and 0 replies)
    const noReplyAccounts = accounts.filter(account => {
      const totalSent = parseFloat(account.fields['Total Sent']) || 0;
      const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
      return totalSent >= 150 && totalReplied === 0;
    });

    console.log(`📧 150+ No Replies: Found ${noReplyAccounts.length} accounts`);
    const mailrNoReply = noReplyAccounts.filter(acc => {
      const esp = (acc.fields['Tag - Email Provider'] || '').toLowerCase();
      return esp.includes('mailr');
    });
    if (mailrNoReply.length > 0) {
      console.log(`✅ Found ${mailrNoReply.length} Mailr accounts in 150+ No Replies`);
    }

    // Group by reseller
    const noReplyResellerGroups = {};
    noReplyAccounts.forEach(account => {
      const reseller = account.fields['Tag - Reseller'] || 'Unknown';
      if (!noReplyResellerGroups[reseller]) {
        noReplyResellerGroups[reseller] = {
          name: reseller,
          accounts: [],
          totalAccounts: 0,
          totalSent: 0,
          totalBounces: 0,
          bounceRateSum: 0,
        };
      }
      const totalSent = parseFloat(account.fields['Total Sent']) || 0;
      const bounced = parseFloat(account.fields['Bounced']) || 0;
      const accountBounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;
      
      noReplyResellerGroups[reseller].accounts.push(account);
      noReplyResellerGroups[reseller].totalAccounts += 1;
      noReplyResellerGroups[reseller].totalSent += totalSent;
      noReplyResellerGroups[reseller].totalBounces += bounced;
      noReplyResellerGroups[reseller].bounceRateSum += accountBounceRate;
    });

    // Group by ESP
    const noReplyEspGroups = {};
    noReplyAccounts.forEach(account => {
      const esp = account.fields['Tag - Email Provider'] || 'Unknown';
      if (!noReplyEspGroups[esp]) {
        noReplyEspGroups[esp] = {
          name: esp,
          accounts: [],
          totalAccounts: 0,
          totalSent: 0,
          totalBounces: 0,
          bounceRateSum: 0,
        };
      }
      const totalSent = parseFloat(account.fields['Total Sent']) || 0;
      const bounced = parseFloat(account.fields['Bounced']) || 0;
      const accountBounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;
      
      noReplyEspGroups[esp].accounts.push(account);
      noReplyEspGroups[esp].totalAccounts += 1;
      noReplyEspGroups[esp].totalSent += totalSent;
      noReplyEspGroups[esp].totalBounces += bounced;
      noReplyEspGroups[esp].bounceRateSum += accountBounceRate;
    });

    // Calculate metrics
    const noReplyResellerStats = Object.values(noReplyResellerGroups).map((group: any) => ({
      ...group,
      bounceRate: group.totalSent > 0 ? ((group.totalBounces / group.totalSent) * 100).toFixed(2) : '0.00',
    }));

    const noReplyEspStats = Object.values(noReplyEspGroups).map((group: any) => ({
      ...group,
      bounceRate: group.totalSent > 0 ? ((group.totalBounces / group.totalSent) * 100).toFixed(2) : '0.00',
    }));

    console.log(`📊 ESP groups in 150+ No Replies:`, Object.keys(noReplyEspGroups).sort());
    const mailrEspInNoReply = Object.keys(noReplyEspGroups).find(esp => esp.toLowerCase().includes('mailr'));
    if (mailrEspInNoReply) {
      console.log(`✅ Mailr ESP found in 150+ No Replies: "${mailrEspInNoReply}" with ${noReplyEspGroups[mailrEspInNoReply].totalAccounts} accounts`);
    }

    setNoReplyAccountsData({
      resellerStats: noReplyResellerStats,
      espStats: noReplyEspStats,
      allAccounts: noReplyAccounts
    });
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
        `"${account.fields['Email'] || ''}"`,
        `"${account.fields['Tag - Reseller'] || ''}"`,
        `"${account.fields['Tag - Email Provider'] || ''}"`,
        `"${account.fields['Name'] || ''}"`,
        `"${account.fields['Status'] || ''}"`,
        `"${account.fields['Client Name (from Client)']?.[0] || ''}"`,
        `"${account.fields['Domain'] || ''}"`,
        `"${account.fields['Account Type'] || ''}"`,
        `"${account.workspace_name || ''}"`,
        account.fields['Total Sent'] || 0,
        account.fields['Total Replied'] || 0,
        account.fields['Bounced'] || 0,
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

  const generateClientSendingData = async (accounts) => {
    const clientGroups = {};

    accounts.forEach(account => {
      const clientName = account.fields['Client Name (from Client)']?.[0] || 'Unknown Client';

      if (!clientGroups[clientName]) {
        clientGroups[clientName] = {
          clientName,
          totalAccounts: 0,
          connectedAccounts: 0,
          totalPrice: 0,
          maxSendingVolume: 0,
          currentAvailableSending: 0,
          zeroReplyRateAccounts: 0,
          accounts: []
        };
      }

      clientGroups[clientName].accounts.push(account);
      clientGroups[clientName].totalAccounts += 1;

      if (account.fields['Status'] === 'Connected') {
        clientGroups[clientName].connectedAccounts += 1;
      }

      const price = parseFloat(account.fields['Price']) || 0;
      clientGroups[clientName].totalPrice += price;

      const volumePerAccount = parseFloat(account.fields['Volume Per Account']) || 0;
      clientGroups[clientName].maxSendingVolume += volumePerAccount;

      const dailyLimit = parseFloat(account.fields['Daily Limit']) || 0;
      clientGroups[clientName].currentAvailableSending += dailyLimit;

      const replyRate = parseFloat(account.fields['Reply Rate Per Account %']) || 0;
      if (replyRate === 0) {
        clientGroups[clientName].zeroReplyRateAccounts += 1;
      }
    });

    // Fetch daily_sending_target from client_registry for all clients
    const clientNames = Object.keys(clientGroups);
    const { data: clientRegistryData, error } = await supabase
      .from('client_registry')
      .select('workspace_name, daily_sending_target')
      .in('workspace_name', clientNames);

    if (error) {
      console.error('Error fetching client daily targets:', error);
    }

    // Create a map of client name -> daily_sending_target
    const dailyTargetMap = {};
    (clientRegistryData || []).forEach(row => {
      dailyTargetMap[row.workspace_name] = row.daily_sending_target || 0;
    });

    const clientData = Object.values(clientGroups).map((client: any) => {
      const zeroReplyRatePercentage = client.totalAccounts > 0
        ? ((client.zeroReplyRateAccounts / client.totalAccounts) * 100).toFixed(1)
        : '0.0';

      // Calculate utilization percentage (available vs max capacity)
      const utilizationPercentage = client.maxSendingVolume > 0
        ? Math.round((client.currentAvailableSending / client.maxSendingVolume) * 100)
        : 0;

      // Fetch daily target from client_registry, fallback to 0 if not found
      const medianDailyTarget = dailyTargetMap[client.clientName] || 0;

      // Calculate shortfall (gap between target and available)
      const shortfall = Math.max(0, medianDailyTarget - client.currentAvailableSending);
      const shortfallPercentage = client.maxSendingVolume > 0
        ? Math.round((shortfall / client.maxSendingVolume) * 100)
        : 0;

      return {
        clientName: client.clientName,
        totalAccounts: client.totalAccounts,
        connectedAccounts: client.connectedAccounts,
        totalPrice: client.totalPrice,
        maxSendingVolume: client.maxSendingVolume,
        currentAvailableSending: client.currentAvailableSending,
        zeroReplyRatePercentage: zeroReplyRatePercentage,
        zeroReplyRateAccounts: client.zeroReplyRateAccounts,
        accounts: client.accounts,
        utilizationPercentage: utilizationPercentage,
        medianDailyTarget: medianDailyTarget,
        shortfall: shortfall,
        shortfallPercentage: shortfallPercentage,
        // Aliases for backwards compatibility with Client Sending Capacity section
        accountCount: client.totalAccounts,
        maxSending: client.maxSendingVolume,
        availableSending: client.currentAvailableSending,
      };
    })
    .filter(client => client.totalAccounts > 0)
    .sort((a, b) => b.maxSendingVolume - a.maxSendingVolume);

    console.log('📊 Client Sending Data for Capacity Analysis:', clientData.length, 'clients');
    if (clientData.length > 0) {
      console.log('Sample client data:', clientData[0]);
    }

    // Set both states - they're used by different sections
    setClientAccountsData(clientData); // For "Client Email Accounts" section
    setClientSendingData(clientData);  // For "Client Sending Capacity Analysis" section
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

  const toggleProvider = useCallback((providerName: string) => {
    setExpandedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(providerName)) {
        newSet.delete(providerName);
      } else {
        newSet.add(providerName);
      }
      return newSet;
    });
  }, []);

  const downloadProviderAccounts = useCallback((provider: any, viewType: string) => {
    // Filter accounts based on view type
    let accountsToExport;
    if (viewType === 'Accounts 50+') {
      accountsToExport = provider.accounts.filter(account => {
        const totalSent = parseFloat(account.fields['Total Sent']) || 0;
        return totalSent >= 50;
      });
    } else if (viewType === '100+ No Replies') {
      accountsToExport = provider.accounts.filter(account => {
        const totalSent = parseFloat(account.fields['Total Sent']) || 0;
        const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
        return totalSent >= 100 && totalReplied === 0;
      });
    } else {
      accountsToExport = provider.accounts; // All accounts for Total Email Sent
    }

    if (accountsToExport.length === 0) {
      alert(`No accounts found for ${provider.name}`);
      return;
    }

    // Sort by reply rate (highest to lowest) for Accounts 50+ view
    if (viewType === 'Accounts 50+') {
      accountsToExport.sort((a, b) => {
        const totalSentA = parseFloat(a.fields['Total Sent']) || 0;
        const totalRepliedA = parseFloat(a.fields['Total Replied']) || 0;
        const replyRateA = totalSentA > 0 ? (totalRepliedA / totalSentA) * 100 : 0;

        const totalSentB = parseFloat(b.fields['Total Sent']) || 0;
        const totalRepliedB = parseFloat(b.fields['Total Replied']) || 0;
        const replyRateB = totalSentB > 0 ? (totalRepliedB / totalSentB) * 100 : 0;

        return replyRateB - replyRateA; // Highest to lowest
      });
    }

    // Create CSV content
    const headers = ['Account Name', 'Client', 'Status', 'Total Sent', 'Total Replied', 'Reply Rate %', 'Daily Limit'];
    const rows = accountsToExport.map(account => {
      const totalSent = parseFloat(account.fields['Total Sent']) || 0;
      const totalReplied = parseFloat(account.fields['Total Replied']) || 0;
      const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(2) : '0.00';
      const clientName = account.fields['Client Name (from Client)']?.[0] || 'Unknown';

      return [
        account.fields['Account Name'] || '',
        clientName,
        account.fields['Status'] || '',
        totalSent,
        totalReplied,
        replyRate,
        account.fields['Daily Limit'] || 0
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Create download with appropriate filename
    let filenameSuffix;
    if (viewType === 'Accounts 50+') {
      filenameSuffix = '50plus';
    } else if (viewType === '100+ No Replies') {
      filenameSuffix = '100plus_no_replies';
    } else {
      filenameSuffix = 'all_accounts';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${provider.name}_${filenameSuffix}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

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

  // Cleanup old cache on mount (data is already fetched by DashboardContext)
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

    // Don't fetch here - DashboardContext already fetches on mount
    // This prevents duplicate API calls
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

  // ✅ NEW: Generate Provider Performance data
  useEffect(() => {
    if (emailAccounts.length > 0) {
      generateProviderPerformanceData(emailAccounts);
    }
  }, [providerPerformanceView, emailAccounts]);

  useEffect(() => {
    if (emailAccounts.length > 0) {
      const loadClientSendingData = async () => {
        try {
          await generateClientSendingData(emailAccounts);
        } catch (error) {
          console.error('Error generating client sending data:', error);
        }
      };
      loadClientSendingData();
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
                        • <span className={`font-semibold ${getDataFreshnessColor()}`}>
                          Synced {formatLastUpdated()}
                        </span>
                        <span className="text-xs ml-2 text-gray-500">
                          (next sync in {getNextSyncTime()})
                        </span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Global Account Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={globalSearchTerm}
                  onChange={(e) => setGlobalSearchTerm(e.target.value)}
                  className="pl-9 pr-8 w-64 bg-background/50 border-border/50 focus:border-primary"
                />
                {globalSearchTerm && (
                  <button
                    onClick={() => setGlobalSearchTerm('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Badge variant="secondary" className="bg-success/10 text-success border-success/40">
                <Activity className="h-3 w-3 mr-1" />
                All Systems Operational
              </Badge>
              <Button
                onClick={triggerManualRefresh}
                disabled={loading || isManualRefreshing || refreshCooldown > 0}
                variant="ghost"
                size="sm"
                className="hover:bg-accent"
                title={refreshCooldown > 0 ? `Cooldown: ${formatCooldownTime()} remaining` : 'Trigger manual email sync'}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(loading || isManualRefreshing) ? 'animate-spin' : ''}`} />
                {refreshCooldown > 0 ? `Wait ${formatCooldownTime()}` : isManualRefreshing ? 'Syncing...' : 'Trigger Sync'}
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

      {/* ✅ NEW: Real-time Sync Progress Bar */}
      {activeSyncJobId && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <SyncProgressBar
            jobId={activeSyncJobId}
            onComplete={handleSyncComplete}
          />
        </div>
      )}

      {/* Global Search Results Panel */}
      {globalSearchResults.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <Card className="bg-card/95 backdrop-blur-md border-primary/20">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  Found {globalSearchResults.length} account{globalSearchResults.length !== 1 ? 's' : ''} matching "{globalSearchTerm}"
                  {globalSearchResults.length === 50 && <span className="text-muted-foreground">(showing first 50)</span>}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGlobalSearchTerm('')}
                  className="h-6 px-2"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="py-2 max-h-96 overflow-y-auto">
              <div className="space-y-1">
                {globalSearchResults.map((account, index) => {
                  const accountKey = `${account.fields?.Email}-${index}`;
                  const isExpanded = expandedSearchAccount === accountKey;

                  return (
                    <div key={index} className="rounded-lg border border-transparent hover:border-border/50 transition-colors">
                      {/* Main Row */}
                      <div
                        onClick={() => setExpandedSearchAccount(isExpanded ? null : accountKey)}
                        className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors text-sm"
                      >
                        <div className="col-span-4 flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-primary flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <Mail className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="truncate font-medium">{account.fields?.Email || 'N/A'}</span>
                        </div>
                        <div className="col-span-2 text-muted-foreground truncate">
                          {account.fields?.Domain || 'N/A'}
                        </div>
                        <div className="col-span-3 text-muted-foreground truncate">
                          {account.workspace_name || 'N/A'}
                        </div>
                        <div className="col-span-2 text-muted-foreground truncate">
                          {account.fields?.['Tag - Email Provider'] || 'N/A'}
                        </div>
                        <div className="col-span-1 text-right">
                          <Badge variant="outline" className={`text-xs ${
                            account.fields?.Status === 'Connected'
                              ? 'bg-success/20 text-success border-success/40'
                              : 'bg-warning/20 text-warning border-warning/40'
                          }`}>
                            {account.fields?.Status === 'Connected' ? 'On' : 'Off'}
                          </Badge>
                        </div>
                      </div>

                      {/* Expanded Details Panel */}
                      {isExpanded && (
                        <div className="mx-2 mb-2 p-3 bg-accent/30 rounded-lg border border-border/50">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {/* Performance Metrics */}
                            <div>
                              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                Performance
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <div className="flex justify-between">
                                  <span>Total Sent:</span>
                                  <span className="font-medium text-foreground">{Number(account.fields?.['Total Sent'] || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Total Replies:</span>
                                  <span className="font-medium text-foreground">{Number(account.fields?.['Total Replied'] || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Reply Rate:</span>
                                  <span className="font-medium text-foreground">{(Number(account.fields?.['Reply Rate Per Account %'] || 0)).toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Bounced:</span>
                                  <span className="font-medium text-foreground">{Number(account.fields?.['Bounced'] || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Configuration */}
                            <div>
                              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                Configuration
                              </h4>
                              <div className="space-y-1 text-muted-foreground">
                                <div className="flex justify-between">
                                  <span>Daily Limit:</span>
                                  <span className="font-medium text-foreground">{account.fields?.['Daily Limit'] || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Volume:</span>
                                  <span className="font-medium text-foreground">{account.fields?.['Volume Per Account'] || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Provider:</span>
                                  <span className="font-medium text-foreground">{account.fields?.['Tag - Email Provider'] || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Price:</span>
                                  <span className="font-medium text-foreground">${Number(account.fields?.['Price'] || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Data Freshness Banner */}
        {lastUpdated && (() => {
          const now = new Date();
          const diffHours = (now.getTime() - lastUpdated.getTime()) / 3600000;

          if (diffHours >= 6) {
            return (
              <div className={`mb-6 p-4 rounded-lg border ${
                diffHours >= 24
                  ? 'bg-red-900/20 border-red-500/50'
                  : 'bg-yellow-900/20 border-yellow-500/50'
              }`}>
                <div className="flex items-center gap-3">
                  {diffHours >= 24 ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Info className="h-5 w-5 text-yellow-500" />
                  )}
                  <div className="flex-1">
                    <h3 className={`font-semibold ${diffHours >= 24 ? 'text-red-300' : 'text-yellow-300'}`}>
                      {diffHours >= 24 ? 'Data is Very Stale' : 'Data May Be Outdated'}
                    </h3>
                    <p className={`text-sm ${diffHours >= 24 ? 'text-red-400' : 'text-yellow-400'}`}>
                      Last synced {formatLastUpdated()} • {getDataFreshnessMessage()}
                      {diffHours >= 24 && ' • Click "Refresh Data" button to update'}
                    </p>
                    {pollingJobStatus && (
                      <div className="mt-2 text-xs text-gray-400">
                        Last sync job: {pollingJobStatus.workspaces_processed}/{pollingJobStatus.total_workspaces} workspaces
                        {pollingJobStatus.status === 'partial' && (
                          <span className="ml-2 text-yellow-400">
                            (⚠️ Incomplete - {pollingJobStatus.workspaces_skipped} skipped due to timeout)
                          </span>
                        )}
                        {pollingJobStatus.status === 'failed' && (
                          <span className="ml-2 text-red-400">
                            (❌ Failed: {pollingJobStatus.error_message})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Polling Job Status - Show even when data is fresh */}
        {pollingJobStatus && pollingJobStatus.status === 'partial' && (() => {
          const now = new Date();
          const diffHours = lastUpdated ? (now.getTime() - lastUpdated.getTime()) / 3600000 : 999;

          // Only show if not already shown in the stale data banner
          if (diffHours < 6) {
            return (
              <div className="mb-6 p-4 rounded-lg border bg-yellow-900/20 border-yellow-500/50">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-300">
                      Last Sync Was Incomplete
                    </h3>
                    <p className="text-sm text-yellow-400">
                      {pollingJobStatus.workspaces_processed}/{pollingJobStatus.total_workspaces} workspaces synced
                      • {pollingJobStatus.workspaces_skipped} skipped due to timeout
                      • Some accounts may be missing from the dashboard
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* ✅ NEW: Tab Navigation */}
        <div className="mb-6">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'home-insurance' && <HomeInsuranceTab />}
        {activeTab === 'performance' && (
          <PerformanceTab
            providerPerformanceView={providerPerformanceView}
            setProviderPerformanceView={setProviderPerformanceView}
            resellerStatsData={resellerStatsData}
            espStatsData={espStatsData}
            top100AccountsData={top100AccountsData}
            noReplyAccountsData={noReplyAccountsData}
            loading={loading}
            expandedProviders={expandedProviders}
            toggleProvider={toggleProvider}
          />
        )}

        {/* ==================================================================
            ALL CLIENTS TAB CONTENT
            ================================================================== */}

        {activeTab === 'all-clients' && (
          <>
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
          </>
        )}

        {/* Accounts Per Client Bar Chart - Overview Tab Only */}
        {activeTab === 'overview' && (
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
        )}

        {/* Simplified Price Analysis - Performance Tab Only */}
        {activeTab === 'performance' && (
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
        )}


        {/* Client Sending Capacity Comparison - All Clients Tab Only */}
        {activeTab === 'all-clients' && (
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
                    if (!clientSendingData || clientSendingData.length === 0) {
                      return <div className="col-span-3 text-center text-white/70 py-8">No client data available</div>;
                    }

                    let displayData;
                    if (selectedClientForSending === 'All Clients') {
                      displayData = clientSendingData.slice(0, 6); // Show top 6 clients
                    } else if (selectedClientForSending === 'Insufficient Capacity') {
                      displayData = clientSendingData.filter(client => (client.medianDailyTarget || 0) > (client.availableSending || 0));
                    } else {
                      displayData = clientSendingData.filter(client => client.clientName === selectedClientForSending);
                    }

                    if (!displayData || displayData.length === 0) {
                      return <div className="col-span-3 text-center text-white/70 py-8">No clients match the selected filter</div>;
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
                            <span className="text-white font-semibold">{(client.maxSending || 0).toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div 
                              className="bg-dashboard-success h-2 rounded-full" 
                              style={{ width: '100%' }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between text-xs">
                            <span className="text-white/70">Available Sending</span>
                            <span className="text-white font-semibold">{(client.availableSending || 0).toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div 
                              className="bg-dashboard-accent h-2 rounded-full" 
                              style={{ width: `${client.utilizationPercentage || 0}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between text-xs">
                            <span className="text-white/70">Daily Target</span>
                            <span className={`font-semibold ${
                              (client.medianDailyTarget || 0) > (client.availableSending || 0)
                                ? 'text-dashboard-warning'
                                : 'text-dashboard-success'
                            }`}>
                              {(client.medianDailyTarget || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                (client.medianDailyTarget || 0) > (client.availableSending || 0)
                                  ? 'bg-dashboard-warning'
                                  : 'bg-dashboard-success'
                              }`}
                              style={{
                                width: `${(client.maxSending || 0) > 0 ? Math.min(((client.medianDailyTarget || 0) / client.maxSending) * 100, 100) : 0}%`
                              }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-white/70">Utilization:</span>
                            <div className="text-white font-semibold">{client.utilizationPercentage || 0}%</div>
                          </div>
                          <div>
                            <span className="text-white/70">Shortfall:</span>
                            <div className="text-dashboard-warning font-semibold">{client.shortfallPercentage || 0}%</div>
                          </div>
                          <div>
                            <span className="text-white/70">Daily Target:</span>
                            <div className="text-white font-semibold">{(client.medianDailyTarget || 0).toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-white/70">Gap:</span>
                            <div className="text-dashboard-warning font-semibold">{(client.shortfall || 0).toLocaleString()}</div>
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
        )}

        {/* Client Accounts View - All Clients Tab Only */}
        {activeTab === 'all-clients' && (
          <>
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
            <Dialog open={isClientModalOpen} onOpenChange={setInfrastructureModalOpen}>
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
          </>
        )}
      </div>

      {/* AI Infrastructure Assistant */}
      <InfraAssistantFAB
        onClick={() => setIsAssistantOpen(true)}
        hasIssues={infraAssistant.detectedIssues.length > 0}
        issueCount={infraAssistant.detectedIssues.length}
      />
      <InfraAssistantSheet
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        messages={infraAssistant.messages}
        isLoading={infraAssistant.isLoading}
        onSendMessage={infraAssistant.sendMessage}
        onClearHistory={infraAssistant.clearHistory}
        detectedIssues={infraAssistant.detectedIssues}
      />
    </div>
  );
};

// Separate component for better performance
const ClientAccountsModal = ({ client, expandedAccountTypes, expandedStatuses, toggleAccountType, toggleStatus, filter }) => {
  // Modal search state
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Ensure we have Set objects (convert if needed)
  const accountTypesSet = useMemo(() => {
    if (expandedAccountTypes instanceof Set) return expandedAccountTypes;
    if (Array.isArray(expandedAccountTypes)) return new Set(expandedAccountTypes);
    if (expandedAccountTypes && typeof expandedAccountTypes === 'object' && typeof expandedAccountTypes !== 'function') {
      return new Set(Object.keys(expandedAccountTypes));
    }
    return new Set();
  }, [expandedAccountTypes]);

  const statusesSet = useMemo(() => {
    if (expandedStatuses instanceof Set) return expandedStatuses;
    if (Array.isArray(expandedStatuses)) return new Set(expandedStatuses);
    if (expandedStatuses && typeof expandedStatuses === 'object' && typeof expandedStatuses !== 'function') {
      return new Set(Object.keys(expandedStatuses));
    }
    return new Set();
  }, [expandedStatuses]);

  // Count total accounts before filtering
  const totalAccountCount = client.accounts?.length || 0;

  const organizedAccounts = useMemo(() => {
    if (!client.accounts || client.accounts.length === 0) {
      return {};
    }

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

    // Apply modal search filter
    if (modalSearchTerm && modalSearchTerm.length >= 2) {
      const term = modalSearchTerm.toLowerCase();
      accountsToProcess = accountsToProcess.filter(account =>
        account.fields?.Email?.toLowerCase().includes(term) ||
        account.fields?.Name?.toLowerCase().includes(term) ||
        account.fields?.Domain?.toLowerCase().includes(term)
      );
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
  }, [client.accounts, filter, modalSearchTerm]);

  // Count filtered accounts
  const filteredAccountCount = useMemo(() => {
    return Object.values(organizedAccounts).reduce((total: number, statusGroups: any) => {
      return total + (statusGroups.Connected?.length || 0) + (statusGroups.Disconnected?.length || 0);
    }, 0);
  }, [organizedAccounts]);

  if (Object.keys(organizedAccounts).length === 0 && !modalSearchTerm) {
    return (
      <div className="text-center py-8">
        <p className="text-white/70">No accounts found for this client.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Modal Search Input */}
      <div className="flex items-center gap-3 pb-2 border-b border-white/10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
          <Input
            placeholder="Filter accounts by email, name, or domain..."
            value={modalSearchTerm}
            onChange={(e) => setModalSearchTerm(e.target.value)}
            className="pl-9 pr-8 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-dashboard-primary"
          />
          {modalSearchTerm && (
            <button
              onClick={() => setModalSearchTerm('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="text-sm text-white/60">
          {modalSearchTerm ? (
            <span>Showing {filteredAccountCount} of {totalAccountCount}</span>
          ) : (
            <span>{totalAccountCount} accounts</span>
          )}
        </div>
      </div>

      {/* No results message */}
      {Object.keys(organizedAccounts).length === 0 && modalSearchTerm && (
        <div className="text-center py-8">
          <p className="text-white/70">No accounts match "{modalSearchTerm}"</p>
        </div>
      )}
      {Object.entries(organizedAccounts).map(([accountType, statusGroups]) => (
        <Collapsible
          key={accountType}
          open={accountTypesSet.has(accountType)}
          onOpenChange={() => toggleAccountType(accountType)}
        >
          <CollapsibleTrigger asChild>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {accountTypesSet.has(accountType) ? (
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
                    open={statusesSet.has(`${accountType}-${status}`)}
                    onOpenChange={() => toggleStatus(`${accountType}-${status}`)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="bg-white/5 rounded-lg p-2 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {statusesSet.has(`${accountType}-${status}`) ? (
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
                                  <span className="text-white font-medium truncate">{account.fields['Email']}</span>
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
                                  Bounced: {account.fields['Bounced'] || 0}
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