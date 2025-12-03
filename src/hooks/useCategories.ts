/**
 * Categories Hook
 *
 * Manages expense category CRUD operations
 * Created: 2025-12-02
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ExpenseCategory, CategoryFormData } from '@/types/expenses';

interface UseCategoriesResult {
  categories: ExpenseCategory[];
  loading: boolean;
  error: string | null;

  createCategory: (data: CategoryFormData) => Promise<ExpenseCategory | null>;
  updateCategory: (id: string, data: Partial<CategoryFormData>) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  reorderCategories: (orderedIds: string[]) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all active categories
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Create a new category
  const createCategory = async (data: CategoryFormData): Promise<ExpenseCategory | null> => {
    try {
      // Get the max sort_order to place new category at the end
      const maxOrder = categories.length > 0
        ? Math.max(...categories.map(c => c.sort_order))
        : 0;

      // Generate slug from name
      const slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: category, error: createError } = await supabase
        .from('expense_categories')
        .insert({
          name: data.name,
          slug,
          description: data.description || null,
          icon: data.icon || null,
          color: data.color,
          sort_order: data.sort_order ?? maxOrder + 1,
          is_tax_deductible: data.is_tax_deductible,
          tax_category: data.tax_category || null,
          is_active: true,
        })
        .select()
        .single();

      if (createError) throw createError;
      await fetchCategories();
      return category;
    } catch (err) {
      console.error('Error creating category:', err);
      setError(err instanceof Error ? err.message : 'Failed to create category');
      return null;
    }
  };

  // Update an existing category
  const updateCategory = async (id: string, data: Partial<CategoryFormData>): Promise<boolean> => {
    try {
      const updateData: Record<string, any> = {};

      if (data.name !== undefined) {
        updateData.name = data.name;
        // Update slug if name changes
        updateData.slug = data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.icon !== undefined) updateData.icon = data.icon || null;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
      if (data.is_tax_deductible !== undefined) updateData.is_tax_deductible = data.is_tax_deductible;
      if (data.tax_category !== undefined) updateData.tax_category = data.tax_category || null;

      const { error: updateError } = await supabase
        .from('expense_categories')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchCategories();
      return true;
    } catch (err) {
      console.error('Error updating category:', err);
      setError(err instanceof Error ? err.message : 'Failed to update category');
      return false;
    }
  };

  // Soft delete a category (set is_active = false)
  const deleteCategory = async (id: string): Promise<boolean> => {
    try {
      // Check if category has expenses
      const { count, error: countError } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);

      if (countError) throw countError;

      if (count && count > 0) {
        setError(`Cannot delete category: ${count} expense(s) are using this category. Reassign them first.`);
        return false;
      }

      const { error: deleteError } = await supabase
        .from('expense_categories')
        .update({ is_active: false })
        .eq('id', id);

      if (deleteError) throw deleteError;
      await fetchCategories();
      return true;
    } catch (err) {
      console.error('Error deleting category:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      return false;
    }
  };

  // Reorder categories by updating sort_order
  const reorderCategories = async (orderedIds: string[]): Promise<boolean> => {
    try {
      // Update each category's sort_order based on its position in the array
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('expense_categories')
          .update({ sort_order: index })
          .eq('id', id)
      );

      const results = await Promise.all(updates);

      // Check if any updates failed
      const failedUpdate = results.find(r => r.error);
      if (failedUpdate?.error) throw failedUpdate.error;

      await fetchCategories();
      return true;
    } catch (err) {
      console.error('Error reordering categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder categories');
      return false;
    }
  };

  return {
    categories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    refresh: fetchCategories,
  };
}
