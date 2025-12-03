/**
 * Expenses Hook
 *
 * Manages expense data fetching, CRUD operations, and analytics
 * Created: 2025-11-27
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  Expense,
  ExpenseCategory,
  Vendor,
  ExpenseAllocation,
  ExpenseReceipt,
  RecurringExpenseTemplate,
  ExpenseTotals,
  ExpenseFormData,
  VendorFormData,
  RecurringExpenseFormData,
} from '@/types/expenses';

interface UseExpensesResult {
  // Data
  expenses: Expense[];
  categories: ExpenseCategory[];
  vendors: Vendor[];
  recurringTemplates: RecurringExpenseTemplate[];
  totals: ExpenseTotals;

  // State
  loading: boolean;
  error: string | null;

  // CRUD Operations
  createExpense: (data: ExpenseFormData) => Promise<Expense | null>;
  updateExpense: (id: string, data: Partial<ExpenseFormData>) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;
  approveExpense: (id: string) => Promise<boolean>;

  // Vendor Operations
  createVendor: (data: VendorFormData) => Promise<Vendor | null>;
  updateVendor: (id: string, data: Partial<VendorFormData>) => Promise<boolean>;
  deleteVendor: (id: string) => Promise<boolean>;

  // Recurring Operations
  createRecurringTemplate: (data: RecurringExpenseFormData) => Promise<RecurringExpenseTemplate | null>;
  updateRecurringTemplate: (id: string, data: Partial<RecurringExpenseFormData>) => Promise<boolean>;
  deleteRecurringTemplate: (id: string) => Promise<boolean>;

  // Receipt Operations
  uploadReceipt: (expenseId: string, file: File) => Promise<ExpenseReceipt | null>;
  deleteReceipt: (receiptId: string) => Promise<boolean>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useExpenses(monthYear?: string): UseExpensesResult {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringExpenseTemplate[]>([]);
  const [totals, setTotals] = useState<ExpenseTotals>({
    mtd_total: 0,
    mtd_approved: 0,
    mtd_pending: 0,
    mtd_by_category: [],
    mtd_overhead: 0,
    mtd_client_allocated: 0,
    mtd_income: 0,
    mtd_expenses_only: 0,
    mtd_net: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current month if not specified
  const currentMonthYear = monthYear || new Date().toISOString().slice(0, 7);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch vendors
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (vendorsError) throw vendorsError;
      setVendors(vendorsData || []);

      // Fetch expenses with allocations and receipts
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_categories(*),
          vendors(*),
          expense_allocations(*),
          expense_receipts(*)
        `)
        .eq('month_year', currentMonthYear)
        .order('expense_date', { ascending: false });

      if (expensesError) throw expensesError;

      // Transform data to match our types
      const transformedExpenses: Expense[] = (expensesData || []).map((e: any) => ({
        ...e,
        category: e.expense_categories,
        vendor: e.vendors,
        allocations: e.expense_allocations,
        receipts: e.expense_receipts,
      }));
      setExpenses(transformedExpenses);

      // Fetch recurring templates
      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_expense_templates')
        .select(`
          *,
          expense_categories(*),
          vendors(*)
        `)
        .eq('is_active', true)
        .order('name');

      if (recurringError) throw recurringError;

      const transformedRecurring: RecurringExpenseTemplate[] = (recurringData || []).map((r: any) => ({
        ...r,
        category: r.expense_categories,
        vendor: r.vendors,
      }));
      setRecurringTemplates(transformedRecurring);

      // Separate income from expenses by category slug
      const incomeExpenses = transformedExpenses.filter(e => e.category?.slug === 'income');
      const regularExpenses = transformedExpenses.filter(e => e.category?.slug !== 'income');

      // Calculate income total
      const mtdIncome = incomeExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Calculate expenses only (excluding income)
      const mtdExpensesOnly = regularExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Calculate totals (all transactions)
      const mtdTotal = transformedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const mtdApproved = transformedExpenses
        .filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const mtdPending = transformedExpenses
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      // Group by category (excluding Income for the chart)
      const byCategory = regularExpenses.reduce((acc, e) => {
        const catName = e.category?.name || 'Uncategorized';
        const catColor = e.category?.color || '#64748b';
        if (!acc[catName]) {
          acc[catName] = { category_name: catName, category_color: catColor, amount: 0 };
        }
        acc[catName].amount += Number(e.amount);
        return acc;
      }, {} as Record<string, { category_name: string; category_color: string; amount: number }>);

      // Calculate overhead vs client allocated (expenses only)
      let mtdOverhead = 0;
      let mtdClientAllocated = 0;
      regularExpenses.forEach(e => {
        if (e.status === 'approved' && e.allocations) {
          e.allocations.forEach(a => {
            if (a.is_overhead) {
              mtdOverhead += Number(a.allocated_amount);
            } else {
              mtdClientAllocated += Number(a.allocated_amount);
            }
          });
        }
      });

      // Net = income - expenses (positive means profit)
      const mtdNet = mtdIncome - mtdExpensesOnly;

      setTotals({
        mtd_total: mtdTotal,
        mtd_approved: mtdApproved,
        mtd_pending: mtdPending,
        mtd_by_category: Object.values(byCategory).sort((a, b) => b.amount - a.amount),
        mtd_overhead: mtdOverhead,
        mtd_client_allocated: mtdClientAllocated,
        mtd_income: mtdIncome,
        mtd_expenses_only: mtdExpensesOnly,
        mtd_net: mtdNet,
      });

    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  }, [currentMonthYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create expense
  const createExpense = async (data: ExpenseFormData): Promise<Expense | null> => {
    try {
      // Insert expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          description: data.description,
          amount: data.amount,
          expense_date: data.expense_date.toISOString().split('T')[0],
          category_id: data.category_id,
          vendor_id: data.vendor_id || null,
          payment_method: data.payment_method || null,
          payment_reference: data.payment_reference || null,
          is_recurring: data.is_recurring,
          recurring_frequency: data.recurring_frequency || null,
          is_tax_deductible: data.is_tax_deductible,
          notes: data.notes || null,
          status: 'pending',
          has_receipt: false,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Insert allocations
      if (data.allocations && data.allocations.length > 0) {
        const allocations = data.allocations.map(a => ({
          expense_id: expense.id,
          workspace_name: a.is_overhead ? null : a.workspace_name,
          is_overhead: a.is_overhead,
          allocation_percentage: a.allocation_percentage,
          allocated_amount: (data.amount * a.allocation_percentage) / 100,
        }));

        const { error: allocError } = await supabase
          .from('expense_allocations')
          .insert(allocations);

        if (allocError) throw allocError;
      }

      // Upload receipt if provided
      if (data.receipt_file) {
        await uploadReceipt(expense.id, data.receipt_file);
      }

      // Optimistic update - add to local state without full refetch
      const newExpense: Expense = {
        ...expense,
        category: categories.find(c => c.id === data.category_id),
        vendor: vendors.find(v => v.id === data.vendor_id),
        allocations: data.allocations?.map(a => ({
          id: crypto.randomUUID(),
          expense_id: expense.id,
          workspace_name: a.is_overhead ? null : a.workspace_name,
          is_overhead: a.is_overhead,
          allocation_percentage: a.allocation_percentage,
          allocated_amount: (data.amount * a.allocation_percentage) / 100,
          created_at: new Date().toISOString(),
        })) || [],
        receipts: [],
      };
      setExpenses(prev => [newExpense, ...prev]);

      return expense;
    } catch (err) {
      console.error('Error creating expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to create expense');
      return null;
    }
  };

  // Update expense
  const updateExpense = async (id: string, data: Partial<ExpenseFormData>): Promise<boolean> => {
    try {
      const updateData: any = {};
      if (data.description !== undefined) updateData.description = data.description;
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.expense_date !== undefined) updateData.expense_date = data.expense_date.toISOString().split('T')[0];
      if (data.category_id !== undefined) updateData.category_id = data.category_id;
      if (data.vendor_id !== undefined) updateData.vendor_id = data.vendor_id || null;
      if (data.payment_method !== undefined) updateData.payment_method = data.payment_method || null;
      if (data.is_recurring !== undefined) updateData.is_recurring = data.is_recurring;
      if (data.is_tax_deductible !== undefined) updateData.is_tax_deductible = data.is_tax_deductible;
      if (data.notes !== undefined) updateData.notes = data.notes || null;

      const { error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update allocations if provided
      if (data.allocations) {
        // Delete existing allocations
        await supabase.from('expense_allocations').delete().eq('expense_id', id);

        // Insert new allocations
        const expense = expenses.find(e => e.id === id);
        const amount = data.amount ?? expense?.amount ?? 0;

        const allocations = data.allocations.map(a => ({
          expense_id: id,
          workspace_name: a.is_overhead ? null : a.workspace_name,
          is_overhead: a.is_overhead,
          allocation_percentage: a.allocation_percentage,
          allocated_amount: (amount * a.allocation_percentage) / 100,
        }));

        const { error: allocError } = await supabase
          .from('expense_allocations')
          .insert(allocations);

        if (allocError) throw allocError;
      }

      // Optimistic update - update local state without full refetch
      setExpenses(prev => prev.map(e => {
        if (e.id !== id) return e;
        return {
          ...e,
          ...updateData,
          category: data.category_id ? categories.find(c => c.id === data.category_id) : e.category,
          vendor: data.vendor_id !== undefined ? vendors.find(v => v.id === data.vendor_id) : e.vendor,
          allocations: data.allocations ? data.allocations.map(a => ({
            id: crypto.randomUUID(),
            expense_id: id,
            workspace_name: a.is_overhead ? null : a.workspace_name,
            is_overhead: a.is_overhead,
            allocation_percentage: a.allocation_percentage,
            allocated_amount: (amount * a.allocation_percentage) / 100,
            created_at: new Date().toISOString(),
          })) : e.allocations,
        };
      }));

      return true;
    } catch (err) {
      console.error('Error updating expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to update expense');
      return false;
    }
  };

  // Delete expense
  const deleteExpense = async (id: string): Promise<boolean> => {
    try {
      // First, unlink any bank transactions that reference this expense
      // This handles expenses created from Plaid imports
      const { error: unlinkError } = await supabase
        .from('bank_transactions')
        .update({ expense_id: null, status: 'categorized' })
        .eq('expense_id', id);

      if (unlinkError) {
        console.warn('Error unlinking bank transactions:', unlinkError);
        // Continue anyway - the table might not exist or no transactions linked
      }

      // Now delete the expense (allocations and receipts cascade automatically)
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Optimistic update - remove from local state without full refetch
      setExpenses(prev => prev.filter(e => e.id !== id));

      return true;
    } catch (err) {
      console.error('Error deleting expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
      return false;
    }
  };

  // Approve expense manually (without receipt)
  const approveExpense = async (id: string): Promise<boolean> => {
    try {
      const approvedAt = new Date().toISOString();
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_at: approvedAt,
        })
        .eq('id', id);

      if (error) throw error;

      // Optimistic update - update status in local state
      setExpenses(prev => prev.map(e =>
        e.id === id ? { ...e, status: 'approved', approved_at: approvedAt } : e
      ));

      return true;
    } catch (err) {
      console.error('Error approving expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve expense');
      return false;
    }
  };

  // Create vendor
  const createVendor = async (data: VendorFormData): Promise<Vendor | null> => {
    try {
      const { data: vendor, error } = await supabase
        .from('vendors')
        .insert({
          name: data.name,
          display_name: data.display_name || null,
          website: data.website || null,
          email: data.email || null,
          phone: data.phone || null,
          category_id: data.category_id || null,
          default_payment_method: data.default_payment_method || null,
          billing_cycle: data.billing_cycle || null,
          typical_amount: data.typical_amount || null,
          notes: data.notes || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistic update - add to local state
      setVendors(prev => [...prev, vendor].sort((a, b) => a.name.localeCompare(b.name)));

      return vendor;
    } catch (err) {
      console.error('Error creating vendor:', err);
      setError(err instanceof Error ? err.message : 'Failed to create vendor');
      return null;
    }
  };

  // Update vendor
  const updateVendor = async (id: string, data: Partial<VendorFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      // Optimistic update
      setVendors(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));

      return true;
    } catch (err) {
      console.error('Error updating vendor:', err);
      setError(err instanceof Error ? err.message : 'Failed to update vendor');
      return false;
    }
  };

  // Delete vendor (soft delete)
  const deleteVendor = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Optimistic update - remove from active vendors list
      setVendors(prev => prev.filter(v => v.id !== id));

      return true;
    } catch (err) {
      console.error('Error deleting vendor:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete vendor');
      return false;
    }
  };

  // Create recurring template
  const createRecurringTemplate = async (data: RecurringExpenseFormData): Promise<RecurringExpenseTemplate | null> => {
    try {
      const startDate = data.start_date.toISOString().split('T')[0];

      const { data: template, error } = await supabase
        .from('recurring_expense_templates')
        .insert({
          name: data.name,
          description: data.description || null,
          amount: data.amount,
          category_id: data.category_id,
          vendor_id: data.vendor_id || null,
          frequency: data.frequency,
          day_of_month: data.day_of_month,
          start_date: startDate,
          end_date: data.end_date?.toISOString().split('T')[0] || null,
          next_occurrence: startDate,
          workspace_name: data.workspace_name || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistic update - add to local state
      const newTemplate: RecurringExpenseTemplate = {
        ...template,
        category: categories.find(c => c.id === data.category_id),
        vendor: vendors.find(v => v.id === data.vendor_id),
      };
      setRecurringTemplates(prev => [...prev, newTemplate].sort((a, b) => a.name.localeCompare(b.name)));

      return template;
    } catch (err) {
      console.error('Error creating recurring template:', err);
      setError(err instanceof Error ? err.message : 'Failed to create recurring template');
      return null;
    }
  };

  // Update recurring template
  const updateRecurringTemplate = async (id: string, data: Partial<RecurringExpenseFormData>): Promise<boolean> => {
    try {
      const updateData: any = { ...data };
      if (data.start_date) updateData.start_date = data.start_date.toISOString().split('T')[0];
      if (data.end_date) updateData.end_date = data.end_date.toISOString().split('T')[0];

      const { error } = await supabase
        .from('recurring_expense_templates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Optimistic update
      setRecurringTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updateData } : t));

      return true;
    } catch (err) {
      console.error('Error updating recurring template:', err);
      setError(err instanceof Error ? err.message : 'Failed to update recurring template');
      return false;
    }
  };

  // Delete recurring template
  const deleteRecurringTemplate = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('recurring_expense_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      // Optimistic update - remove from list
      setRecurringTemplates(prev => prev.filter(t => t.id !== id));

      return true;
    } catch (err) {
      console.error('Error deleting recurring template:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete recurring template');
      return false;
    }
  };

  // Upload receipt
  const uploadReceipt = async (expenseId: string, file: File): Promise<ExpenseReceipt | null> => {
    try {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const fileName = `${Date.now()}-${file.name}`;
      const storagePath = `receipts/${year}/${month}/${expenseId}/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Create receipt record
      const { data: receipt, error: receiptError } = await supabase
        .from('expense_receipts')
        .insert({
          expense_id: expenseId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          storage_bucket: 'expense-receipts',
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Optimistic update - add receipt to expense
      setExpenses(prev => prev.map(e => {
        if (e.id !== expenseId) return e;
        return {
          ...e,
          has_receipt: true,
          status: 'approved',
          receipts: [...(e.receipts || []), receipt],
        };
      }));

      return receipt;
    } catch (err) {
      console.error('Error uploading receipt:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload receipt');
      return null;
    }
  };

  // Delete receipt
  const deleteReceipt = async (receiptId: string): Promise<boolean> => {
    try {
      // Get receipt info first
      const { data: receipt, error: fetchError } = await supabase
        .from('expense_receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('expense-receipts')
        .remove([receipt.storage_path]);

      if (storageError) {
        console.warn('Could not delete file from storage:', storageError);
      }

      // Delete record
      const { error: deleteError } = await supabase
        .from('expense_receipts')
        .delete()
        .eq('id', receiptId);

      if (deleteError) throw deleteError;

      // Optimistic update - remove receipt from expense
      setExpenses(prev => prev.map(e => {
        if (e.id !== receipt.expense_id) return e;
        const updatedReceipts = (e.receipts || []).filter(r => r.id !== receiptId);
        return {
          ...e,
          receipts: updatedReceipts,
          has_receipt: updatedReceipts.length > 0,
          status: updatedReceipts.length > 0 ? e.status : 'pending',
        };
      }));

      // Also update in DB if no receipts left
      const expense = expenses.find(e => e.id === receipt.expense_id);
      const remainingReceipts = (expense?.receipts || []).filter(r => r.id !== receiptId);
      if (remainingReceipts.length === 0) {
        await supabase
          .from('expenses')
          .update({ has_receipt: false, status: 'pending' })
          .eq('id', receipt.expense_id);
      }

      return true;
    } catch (err) {
      console.error('Error deleting receipt:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete receipt');
      return false;
    }
  };

  return {
    expenses,
    categories,
    vendors,
    recurringTemplates,
    totals,
    loading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    createVendor,
    updateVendor,
    deleteVendor,
    createRecurringTemplate,
    updateRecurringTemplate,
    deleteRecurringTemplate,
    uploadReceipt,
    deleteReceipt,
    refresh: fetchData,
  };
}
