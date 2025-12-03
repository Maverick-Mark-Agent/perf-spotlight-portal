/**
 * Plaid Integration Hook
 *
 * Manages bank connections, accounts, and transaction syncing
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlaidConnection {
  id: string;
  item_id: string;
  institution_id: string;
  institution_name: string;
  status: 'active' | 'error' | 'pending_reauth';
  error_code?: string;
  error_message?: string;
  last_synced_at?: string;
  created_at: string;
  accounts?: PlaidAccount[];
}

interface PlaidAccount {
  id: string;
  connection_id: string;
  account_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype: string;
  mask: string;
  current_balance: number;
  available_balance?: number;
  currency_code: string;
  is_active: boolean;
  last_balance_update?: string;
}

interface BankTransaction {
  id: string;
  account_id: string;
  transaction_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  plaid_category?: string[];
  personal_finance_category?: string;
  category_id?: string;
  vendor_id?: string;
  expense_id?: string;
  status: 'pending' | 'categorized' | 'matched' | 'ignored';
  is_pending: boolean;
  payment_channel?: string;
  is_recurring?: boolean;
  recurring_type?: string;
  recurring_name?: string;
  ai_confidence?: string;
}

interface UsePlaidResult {
  // Data
  connections: PlaidConnection[];
  transactions: BankTransaction[];

  // State
  loading: boolean;
  syncing: boolean;
  error: string | null;

  // Actions
  getLinkToken: () => Promise<string | null>;
  exchangeToken: (publicToken: string, institution: { institution_id: string; name: string }) => Promise<boolean>;
  syncTransactions: (connectionId: string) => Promise<boolean>;
  syncAllConnections: () => Promise<void>;
  disconnectBank: (connectionId: string) => Promise<boolean>;
  categorizeTransaction: (transactionId: string, categoryId: string, vendorId?: string) => Promise<boolean>;
  ignoreTransaction: (transactionId: string) => Promise<boolean>;
  convertToExpense: (transactionId: string) => Promise<boolean>;
  convertAllToExpenses: () => Promise<number>;
  autoCategorizeAll: () => Promise<{ categorized: number; recurring: number }>;
  refresh: () => Promise<void>;
}

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';

// Normalize vendor names for consistent matching
function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(inc|llc|co|corp|payment|pymt|ach|debit|charge|transaction)\.?/gi, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function usePlaid(): UsePlaidResult {
  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch connections and transactions
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch connections with accounts
      const { data: connectionsData, error: connError } = await supabase
        .from('plaid_connections')
        .select(`
          *,
          plaid_accounts(*)
        `)
        .order('created_at', { ascending: false });

      if (connError) throw connError;

      const transformedConnections: PlaidConnection[] = (connectionsData || []).map((c: any) => ({
        ...c,
        accounts: c.plaid_accounts,
      }));
      setConnections(transformedConnections);

      // Fetch ALL transactions that need attention (pending or categorized, not matched/ignored)
      const { data: txData, error: txError } = await supabase
        .from('bank_transactions')
        .select('*')
        .in('status', ['pending', 'categorized'])
        .order('date', { ascending: false });

      if (txError) throw txError;
      setTransactions(txData || []);

    } catch (err) {
      console.error('Error fetching Plaid data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get Plaid Link token
  const getLinkToken = async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/plaid-link-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      return data.link_token;
    } catch (err) {
      console.error('Error getting link token:', err);
      setError(err instanceof Error ? err.message : 'Failed to get link token');
      return null;
    }
  };

  // Exchange public token for access token
  const exchangeToken = async (
    publicToken: string,
    institution: { institution_id: string; name: string }
  ): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/plaid-exchange-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_token: publicToken, institution }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      await fetchData();
      return true;
    } catch (err) {
      console.error('Error exchanging token:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect bank');
      return false;
    }
  };

  // Sync transactions for a connection
  const syncTransactions = async (connectionId: string): Promise<boolean> => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/plaid-sync-transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connection_id: connectionId }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      await fetchData();
      return true;
    } catch (err) {
      console.error('Error syncing transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync transactions');
      return false;
    } finally {
      setSyncing(false);
    }
  };

  // Sync all connections
  const syncAllConnections = async (): Promise<void> => {
    for (const conn of connections) {
      if (conn.status === 'active') {
        await syncTransactions(conn.id);
      }
    }
  };

  // Disconnect a bank
  const disconnectBank = async (connectionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('plaid_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      await fetchData();
      return true;
    } catch (err) {
      console.error('Error disconnecting bank:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect bank');
      return false;
    }
  };

  // Categorize a transaction and save learning rule
  const categorizeTransaction = async (
    transactionId: string,
    categoryId: string,
    vendorId?: string
  ): Promise<boolean> => {
    try {
      // First get the transaction to extract vendor name
      const { data: tx } = await supabase
        .from('bank_transactions')
        .select('merchant_name, name')
        .eq('id', transactionId)
        .single();

      // Update the transaction
      const { error } = await supabase
        .from('bank_transactions')
        .update({
          category_id: categoryId,
          vendor_id: vendorId || null,
          status: 'categorized',
        })
        .eq('id', transactionId);

      if (error) throw error;

      // Save learning rule for this vendor
      if (tx) {
        const vendorName = tx.merchant_name || tx.name;
        const normalizedVendor = normalizeVendorName(vendorName);

        if (normalizedVendor.length >= 3) { // Only save if meaningful name
          await supabase.from('expense_learning_log').upsert({
            learning_type: 'vendor_category',
            vendor_name: normalizedVendor,
            learned_mapping: { category_id: categoryId },
            confidence_score: 0.95,
            times_applied: 0,
            is_active: true,
          }, {
            onConflict: 'vendor_name,learning_type',
            ignoreDuplicates: false
          });
          console.log(`Learned: "${normalizedVendor}" → category ${categoryId}`);
        }
      }

      await fetchData();
      return true;
    } catch (err) {
      console.error('Error categorizing transaction:', err);
      return false;
    }
  };

  // Ignore a transaction
  const ignoreTransaction = async (transactionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ status: 'ignored' })
        .eq('id', transactionId);

      if (error) throw error;

      await fetchData();
      return true;
    } catch (err) {
      console.error('Error ignoring transaction:', err);
      return false;
    }
  };

  // Convert transaction to expense
  const convertToExpense = async (transactionId: string): Promise<boolean> => {
    try {
      // Get the transaction
      const { data: tx, error: fetchError } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (fetchError || !tx) throw new Error('Transaction not found');

      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          description: tx.merchant_name || tx.name,
          amount: Math.abs(tx.amount), // Convert to positive
          expense_date: tx.date,
          category_id: tx.category_id,
          vendor_id: tx.vendor_id,
          status: 'approved',
          has_receipt: false,
          notes: `Imported from bank: ${tx.name}`,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Link transaction to expense
      await supabase
        .from('bank_transactions')
        .update({
          expense_id: expense.id,
          status: 'matched',
        })
        .eq('id', transactionId);

      await fetchData();
      return true;
    } catch (err) {
      console.error('Error converting to expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to create expense');
      return false;
    }
  };

  // Convert all categorized transactions to expenses
  const convertAllToExpenses = async (): Promise<number> => {
    try {
      const categorizedTxs = transactions.filter(
        tx => tx.status === 'categorized' && tx.amount > 0
      );

      if (categorizedTxs.length === 0) {
        return 0;
      }

      let converted = 0;
      for (const tx of categorizedTxs) {
        // Create expense
        const { data: expense, error: expenseError } = await supabase
          .from('expenses')
          .insert({
            description: tx.merchant_name || tx.name,
            amount: Math.abs(tx.amount),
            expense_date: tx.date,
            category_id: tx.category_id,
            vendor_id: tx.vendor_id,
            status: 'approved',
            has_receipt: false,
            notes: `Imported from bank: ${tx.name}`,
          })
          .select()
          .single();

        if (!expenseError && expense) {
          // Link transaction to expense
          await supabase
            .from('bank_transactions')
            .update({
              expense_id: expense.id,
              status: 'matched',
            })
            .eq('id', tx.id);
          converted++;
        }
      }

      await fetchData();
      return converted;
    } catch (err) {
      console.error('Error converting all to expenses:', err);
      setError(err instanceof Error ? err.message : 'Failed to convert expenses');
      return 0;
    }
  };

  // Auto-categorize all pending transactions using AI
  const autoCategorizeAll = async (): Promise<{ categorized: number; recurring: number }> => {
    try {
      const pendingTxIds = transactions
        .filter(tx => tx.status === 'pending')
        .map(tx => tx.id);

      if (pendingTxIds.length === 0) {
        console.log('No pending transactions to categorize');
        return { categorized: 0, recurring: 0 };
      }

      console.log(`Auto-categorizing ${pendingTxIds.length} transactions...`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        setError('Please log in to use auto-categorization');
        return { categorized: 0, recurring: 0 };
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/categorize-transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_ids: pendingTxIds,
          auto_apply: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Categorize API error:', response.status, errorText);
        setError(`Categorization failed: ${response.status}`);
        return { categorized: 0, recurring: 0 };
      }

      const data = await response.json();
      if (data.error) {
        console.error('Categorize response error:', data.error);
        setError(data.error);
        return { categorized: 0, recurring: 0 };
      }

      console.log('Categorization result:', data);

      // Update recurring flags in database
      if (data.results) {
        for (const result of data.results) {
          if (result.is_recurring) {
            await supabase
              .from('bank_transactions')
              .update({
                is_recurring: true,
                recurring_type: result.recurring_type,
                recurring_name: result.recurring_name,
                ai_confidence: result.confidence,
              })
              .eq('id', result.transaction_id);
          }
        }
      }

      await fetchData();
      return {
        categorized: data.categorized || 0,
        recurring: data.recurring || 0,
      };
    } catch (err) {
      console.error('Error auto-categorizing:', err);
      setError(err instanceof Error ? err.message : 'Failed to auto-categorize');
      return { categorized: 0, recurring: 0 };
    }
  };

  return {
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
    refresh: fetchData,
  };
}
