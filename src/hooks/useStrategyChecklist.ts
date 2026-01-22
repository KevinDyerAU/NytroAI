import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ChecklistItem {
  id: number;
  item_id: string;
  category: string;
  section: string;
  title: string;
  description: string | null;
  target_date: string | null;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  priority: 'high' | 'medium' | 'low';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistStats {
  total: number;
  completed: number;
  percentage: number;
  byCategory: Record<string, { total: number; completed: number }>;
  bySection: Record<string, { total: number; completed: number }>;
}

export function useStrategyChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ChecklistStats>({
    total: 0,
    completed: 0,
    percentage: 0,
    byCategory: {},
    bySection: {},
  });

  // Calculate stats from items
  const calculateStats = useCallback((items: ChecklistItem[]): ChecklistStats => {
    const total = items.length;
    const completed = items.filter(item => item.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byCategory: Record<string, { total: number; completed: number }> = {};
    const bySection: Record<string, { total: number; completed: number }> = {};

    items.forEach(item => {
      // By category
      if (!byCategory[item.category]) {
        byCategory[item.category] = { total: 0, completed: 0 };
      }
      byCategory[item.category].total++;
      if (item.completed) byCategory[item.category].completed++;

      // By section
      if (!bySection[item.section]) {
        bySection[item.section] = { total: 0, completed: 0 };
      }
      bySection[item.section].total++;
      if (item.completed) bySection[item.section].completed++;
    });

    return { total, completed, percentage, byCategory, bySection };
  }, []);

  // Fetch all checklist items
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('strategy_checklist_items')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;

      const fetchedItems = data as ChecklistItem[];
      setItems(fetchedItems);
      setStats(calculateStats(fetchedItems));
    } catch (err) {
      console.error('Error fetching checklist items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch checklist items');
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  // Toggle item completion status
  const toggleItem = useCallback(async (itemId: string) => {
    try {
      const item = items.find(i => i.item_id === itemId);
      if (!item) return;

      const newCompleted = !item.completed;
      const updates: Partial<ChecklistItem> = {
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      };

      const { error: updateError } = await supabase
        .from('strategy_checklist_items')
        .update(updates)
        .eq('item_id', itemId);

      if (updateError) throw updateError;

      // Optimistically update local state
      setItems(prev => {
        const updated = prev.map(i =>
          i.item_id === itemId
            ? { ...i, ...updates, updated_at: new Date().toISOString() }
            : i
        );
        setStats(calculateStats(updated));
        return updated;
      });
    } catch (err) {
      console.error('Error toggling item:', err);
      setError(err instanceof Error ? err.message : 'Failed to update item');
      // Refetch to ensure consistency
      fetchItems();
    }
  }, [items, calculateStats, fetchItems]);

  // Add a new checklist item
  const addItem = useCallback(async (newItem: Omit<ChecklistItem, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'completed_by'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('strategy_checklist_items')
        .insert([{
          ...newItem,
          completed: false,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      setItems(prev => {
        const updated = [...prev, data as ChecklistItem].sort((a, b) => a.sort_order - b.sort_order);
        setStats(calculateStats(updated));
        return updated;
      });

      return data as ChecklistItem;
    } catch (err) {
      console.error('Error adding item:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item');
      throw err;
    }
  }, [calculateStats]);

  // Update an existing checklist item
  const updateItem = useCallback(async (itemId: string, updates: Partial<Omit<ChecklistItem, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { error: updateError } = await supabase
        .from('strategy_checklist_items')
        .update(updates)
        .eq('item_id', itemId);

      if (updateError) throw updateError;

      setItems(prev => {
        const updated = prev.map(i =>
          i.item_id === itemId
            ? { ...i, ...updates, updated_at: new Date().toISOString() }
            : i
        ).sort((a, b) => a.sort_order - b.sort_order);
        setStats(calculateStats(updated));
        return updated;
      });
    } catch (err) {
      console.error('Error updating item:', err);
      setError(err instanceof Error ? err.message : 'Failed to update item');
      throw err;
    }
  }, [calculateStats]);

  // Delete a checklist item
  const deleteItem = useCallback(async (itemId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('strategy_checklist_items')
        .delete()
        .eq('item_id', itemId);

      if (deleteError) throw deleteError;

      setItems(prev => {
        const updated = prev.filter(i => i.item_id !== itemId);
        setStats(calculateStats(updated));
        return updated;
      });
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      throw err;
    }
  }, [calculateStats]);

  // Get items by category
  const getItemsByCategory = useCallback((category: string) => {
    return items.filter(item => item.category === category);
  }, [items]);

  // Get items by section
  const getItemsBySection = useCallback((section: string) => {
    return items.filter(item => item.section === section);
  }, [items]);

  // Initial fetch
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Set up real-time subscription
  useEffect(() => {
    const subscription = supabase
      .channel('strategy_checklist_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strategy_checklist_items',
        },
        () => {
          // Refetch on any change
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchItems]);

  return {
    items,
    loading,
    error,
    stats,
    fetchItems,
    toggleItem,
    addItem,
    updateItem,
    deleteItem,
    getItemsByCategory,
    getItemsBySection,
  };
}

// Export a function to get progress report data (for scheduled tasks)
export async function getChecklistProgressReport(): Promise<{
  stats: ChecklistStats;
  items: ChecklistItem[];
  recentlyCompleted: ChecklistItem[];
  overdue: ChecklistItem[];
}> {
  const { data, error } = await supabase
    .from('strategy_checklist_items')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;

  const items = data as ChecklistItem[];
  const total = items.length;
  const completed = items.filter(item => item.completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const byCategory: Record<string, { total: number; completed: number }> = {};
  const bySection: Record<string, { total: number; completed: number }> = {};

  items.forEach(item => {
    if (!byCategory[item.category]) {
      byCategory[item.category] = { total: 0, completed: 0 };
    }
    byCategory[item.category].total++;
    if (item.completed) byCategory[item.category].completed++;

    if (!bySection[item.section]) {
      bySection[item.section] = { total: 0, completed: 0 };
    }
    bySection[item.section].total++;
    if (item.completed) bySection[item.section].completed++;
  });

  // Get items completed in the last 7 days
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentlyCompleted = items.filter(
    item => item.completed && item.completed_at && new Date(item.completed_at) >= oneWeekAgo
  );

  // Get overdue items (incomplete items with past target dates)
  const today = new Date();
  const overdue = items.filter(item => {
    if (item.completed || !item.target_date) return false;
    // Simple date parsing for common formats
    const targetDate = new Date(item.target_date);
    return !isNaN(targetDate.getTime()) && targetDate < today;
  });

  return {
    stats: { total, completed, percentage, byCategory, bySection },
    items,
    recentlyCompleted,
    overdue,
  };
}
