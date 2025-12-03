/**
 * Bank Connections Tab
 *
 * Connect bank accounts via Plaid for automatic transaction import
 */

import { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Plus,
  RefreshCw,
  CreditCard,
  Wallet,
  AlertCircle,
  MoreVertical,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Shield,
  Lock,
  Sparkles,
  Repeat,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { usePlaid } from '@/hooks/usePlaid';
import { useExpenses } from '@/hooks/useExpenses';
import { formatDistanceToNow } from 'date-fns';
import { ExpenseAssistantPanel } from './assistant';

export default function BankConnectionsTab() {
  const {
    connections,
    transactions,
    loading,
    syncing,
    error,
    getLinkToken,
    exchangeToken,
    syncTransactions,
    syncAllConnections,
    disconnectBank,
    categorizeTransaction,
    ignoreTransaction,
    convertToExpense,
    convertAllToExpenses,
    autoCategorizeAll,
    refresh,
  } = usePlaid();

  const { categories, vendors } = useExpenses();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [assistantExpanded, setAssistantExpanded] = useState(true);
  const [banksExpanded, setBanksExpanded] = useState(false); // Start collapsed

  // Toggle selection of a transaction
  const toggleSelect = (txId: string) => {
    setSelectedTxIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  // Select all visible transactions
  const selectAllPending = () => {
    const allPendingIds = pendingTransactions.map(tx => tx.id);
    setSelectedTxIds(new Set(allPendingIds));
  };

  const selectAllCategorized = () => {
    const allCategorizedIds = categorizedTransactions.map(tx => tx.id);
    setSelectedTxIds(new Set(allCategorizedIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTxIds(new Set());
    setBulkCategoryId('');
  };

  // Bulk categorize selected transactions
  const handleBulkCategorize = async () => {
    if (!bulkCategoryId || selectedTxIds.size === 0) return;

    setCategorizing(true);
    try {
      for (const txId of selectedTxIds) {
        await categorizeTransaction(txId, bulkCategoryId);
      }
      clearSelection();
    } catch (err) {
      console.error('Bulk categorize error:', err);
    } finally {
      setCategorizing(false);
    }
  };

  // Initialize Plaid Link
  const initPlaidLink = async () => {
    setConnecting(true);
    const token = await getLinkToken();
    if (token) {
      setLinkToken(token);
    }
    setConnecting(false);
  };

  // Handle successful Plaid Link
  const onSuccess = useCallback(async (publicToken: string, metadata: any) => {
    await exchangeToken(publicToken, {
      institution_id: metadata.institution?.institution_id,
      name: metadata.institution?.name,
    });
    setLinkToken(null);
  }, [exchangeToken]);

  // Plaid Link config
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  // Open Plaid Link when token is ready
  if (linkToken && ready) {
    open();
  }

  // Get pending transactions (not yet categorized or converted)
  const pendingTransactions = transactions.filter(
    tx => tx.status === 'pending' && tx.amount > 0 // Only expenses (positive = money out in Plaid)
  );

  // Get categorized transactions (ready to be converted to expenses)
  const categorizedTransactions = transactions.filter(
    tx => tx.status === 'categorized' && tx.amount > 0
  );

  // Get recurring transactions
  const recurringTransactions = transactions.filter(tx => tx.is_recurring);

  // Handle auto-categorize
  const handleAutoCategorize = async () => {
    try {
      setCategorizing(true);
      const result = await autoCategorizeAll();
      console.log(`Categorized: ${result.categorized}, Recurring: ${result.recurring}`);
    } catch (err) {
      console.error('Auto-categorize error:', err);
    } finally {
      setCategorizing(false);
    }
  };

  // Handle convert all to expenses
  const handleConvertAll = async () => {
    try {
      setConverting(true);
      const count = await convertAllToExpenses();
      console.log(`Converted ${count} transactions to expenses`);
    } catch (err) {
      console.error('Convert all error:', err);
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-140px)]">
        <div className="flex-1 overflow-y-auto pr-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
        <ExpenseAssistantPanel
          expanded={assistantExpanded}
          onToggle={() => setAssistantExpanded(!assistantExpanded)}
          onExpensesChanged={refresh}
          context="bank_transactions"
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)]">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-4 space-y-6">
      {/* Security Notice */}
      <Alert className="bg-green-50 border-green-200">
        <Shield className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 flex items-center gap-2">
          <Lock className="h-3 w-3" />
          Bank-Level Security
        </AlertTitle>
        <AlertDescription className="text-green-700">
          Your credentials are never stored. We use Plaid's read-only access to view transactions only - we cannot move money or make changes to your accounts.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Connected Banks - Collapsible */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setBanksExpanded(!banksExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {banksExpanded ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Connected Banks
                  {connections.length > 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {connections.length} connected
                    </Badge>
                  )}
                </CardTitle>
                {!banksExpanded && connections.length > 0 && (
                  <CardDescription className="text-xs mt-0.5">
                    {connections.map(c => c.institution_name).join(', ')}
                  </CardDescription>
                )}
              </div>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              {connections.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={syncAllConnections}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Sync All
                </Button>
              )}
              <Button
                size="sm"
                onClick={initPlaidLink}
                disabled={connecting}
              >
                <Plus className="h-4 w-4 mr-2" />
                Connect Bank
              </Button>
            </div>
          </div>
        </CardHeader>
        {banksExpanded && (
          <CardContent>
            {connections.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-medium mb-1">No banks connected</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Connect your bank to automatically import transactions
                </p>
                <Button onClick={initPlaidLink} disabled={connecting} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Your First Bank
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{conn.institution_name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {conn.accounts?.map((acc, i) => (
                            <span key={acc.id} className="flex items-center gap-1">
                              {acc.type === 'credit' ? (
                                <CreditCard className="h-3 w-3" />
                              ) : (
                                <Wallet className="h-3 w-3" />
                              )}
                              {acc.name} (•••{acc.mask})
                              {i < (conn.accounts?.length || 0) - 1 && ', '}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={conn.status === 'active' ? 'default' : 'destructive'}
                        className={conn.status === 'active' ? 'bg-green-100 text-green-800 text-xs' : 'text-xs'}
                      >
                        {conn.status === 'active' ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {conn.status === 'active' ? 'Connected' : conn.status === 'pending_reauth' ? 'Reauth' : 'Error'}
                      </Badge>
                      {conn.last_synced_at && (
                        <span className="text-xs text-muted-foreground hidden md:inline">
                          {formatDistanceToNow(new Date(conn.last_synced_at), { addSuffix: true })}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => syncTransactions(conn.id)}
                        disabled={syncing}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => disconnectBank(conn.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Bulk Action Bar - shows when items are selected */}
      {selectedTxIds.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {selectedTxIds.size} selected
                </Badge>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear selection
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Bulk categorize as:</span>
                <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                  <SelectTrigger className="w-[200px] h-8 bg-white">
                    <span className="text-gray-900 truncate">
                      {bulkCategoryId
                        ? categories.find(c => c.id === bulkCategoryId)?.name
                        : 'Select category'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleBulkCategorize}
                  disabled={!bulkCategoryId || categorizing}
                >
                  {categorizing ? 'Applying...' : `Apply to ${selectedTxIds.size} items`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Transactions */}
      {pendingTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pending Transactions
                </CardTitle>
                <CardDescription>
                  Review and categorize imported transactions
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={selectAllPending}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    handleAutoCategorize();
                  }}
                  disabled={categorizing || pendingTransactions.length === 0}
                >
                  <Sparkles className={`h-4 w-4 mr-2 ${categorizing ? 'animate-pulse' : ''}`} />
                  {categorizing ? 'Categorizing...' : 'Auto-Categorize All'}
                </Button>
                <Badge variant="secondary">{pendingTransactions.length} pending</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTransactions.slice(0, 50).map((tx) => (
                  <TableRow
                    key={tx.id}
                    className={selectedTxIds.has(tx.id) ? 'bg-blue-50' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedTxIds.has(tx.id)}
                        onCheckedChange={() => toggleSelect(tx.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(tx.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{tx.merchant_name || tx.name}</p>
                          {tx.is_recurring && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              <Repeat className="h-3 w-3 mr-1" />
                              {tx.recurring_type || 'Recurring'}
                            </Badge>
                          )}
                        </div>
                        {tx.personal_finance_category && (
                          <p className="text-xs text-muted-foreground">
                            {tx.personal_finance_category}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Math.abs(tx.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tx.category_id || 'none'}
                        onValueChange={(value) => {
                          if (value !== 'none') {
                            categorizeTransaction(tx.id, value);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px] h-8 bg-white border-gray-300">
                          <span className="text-gray-900 truncate">
                            {tx.category_id
                              ? categories.find(c => c.id === tx.category_id)?.name || 'Unknown'
                              : 'Select category'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Select category</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => convertToExpense(tx.id)}
                          disabled={!tx.category_id}
                        >
                          <ArrowRightLeft className="h-3 w-3 mr-1" />
                          Add as Expense
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => ignoreTransaction(tx.id)}
                        >
                          Ignore
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pendingTransactions.length > 50 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                And {pendingTransactions.length - 50} more transactions...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Categorized Transactions - Ready to be expenses */}
      {categorizedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Categorized Transactions
                </CardTitle>
                <CardDescription>
                  Ready to be added as expenses
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={selectAllCategorized}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    handleConvertAll();
                  }}
                  disabled={converting || categorizedTransactions.length === 0}
                >
                  <ArrowRightLeft className={`h-4 w-4 mr-2 ${converting ? 'animate-pulse' : ''}`} />
                  {converting ? 'Converting...' : 'Add All as Expenses'}
                </Button>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {categorizedTransactions.length} ready
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorizedTransactions.slice(0, 50).map((tx) => (
                  <TableRow
                    key={tx.id}
                    className={selectedTxIds.has(tx.id) ? 'bg-blue-50' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedTxIds.has(tx.id)}
                        onCheckedChange={() => toggleSelect(tx.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(tx.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{tx.merchant_name || tx.name}</p>
                          {tx.is_recurring && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              <Repeat className="h-3 w-3 mr-1" />
                              {tx.recurring_type || 'Recurring'}
                            </Badge>
                          )}
                        </div>
                        {tx.personal_finance_category && (
                          <p className="text-xs text-muted-foreground">
                            {tx.personal_finance_category}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Math.abs(tx.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={tx.category_id || 'none'}
                        onValueChange={(value) => {
                          if (value !== 'none') {
                            categorizeTransaction(tx.id, value);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px] h-8 bg-green-50 border-green-300">
                          <span className="text-green-800 truncate">
                            {tx.category_id
                              ? categories.find(c => c.id === tx.category_id)?.name || 'Unknown'
                              : 'Select category'}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Select category</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => convertToExpense(tx.id)}
                      >
                        <ArrowRightLeft className="h-3 w-3 mr-1" />
                        Add as Expense
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {categorizedTransactions.length > 50 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                And {categorizedTransactions.length - 50} more transactions...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recurring Transactions */}
      {recurringTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Repeat className="h-5 w-5 text-purple-600" />
                  Recurring Payments
                </CardTitle>
                <CardDescription>
                  Detected subscriptions and regular payments
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                {recurringTransactions.length} detected
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recurringTransactions.slice(0, 9).map((tx) => (
                <div key={tx.id} className="p-4 border rounded-lg bg-purple-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {tx.recurring_type || 'recurring'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="font-medium truncate">{tx.recurring_name || tx.merchant_name || tx.name}</p>
                  <p className="text-lg font-bold text-purple-700 mt-1">
                    ${Math.abs(tx.amount).toFixed(2)}/mo
                  </p>
                </div>
              ))}
            </div>
            {recurringTransactions.length > 9 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                And {recurringTransactions.length - 9} more recurring payments...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Balances */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.flatMap(conn =>
                conn.accounts?.map(acc => (
                  <div
                    key={acc.id}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {acc.type === 'credit' ? (
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground">{acc.subtype}</span>
                    </div>
                    <p className="font-medium">{acc.name}</p>
                    <p className="text-2xl font-bold mt-1">
                      ${acc.current_balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                    {acc.available_balance !== null && acc.available_balance !== acc.current_balance && (
                      <p className="text-xs text-muted-foreground">
                        Available: ${acc.available_balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                )) || []
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* AI Assistant - Right Side Panel */}
      <ExpenseAssistantPanel
        expanded={assistantExpanded}
        onToggle={() => setAssistantExpanded(!assistantExpanded)}
        onExpensesChanged={refresh}
        context="bank_transactions"
        contextData={{
          pendingCount: pendingTransactions.length,
          categorizedCount: categorizedTransactions.length,
          recurringCount: recurringTransactions.length,
          categories: categories.map(c => ({ id: c.id, name: c.name })),
        }}
      />
    </div>
  );
}
