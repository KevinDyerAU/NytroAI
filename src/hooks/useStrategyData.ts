import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ============ TYPES ============

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

export interface RoadmapItem {
  id: number;
  item_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: 'planned' | 'in-progress' | 'completed' | 'monitoring';
  priority: 'high' | 'medium' | 'low';
  category: string;
  icon: string | null;
  details: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TimelineMilestone {
  id: number;
  month_key: string;
  month_label: string;
  title: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  items: string[];
  year: number;
  month_number: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContentBlock {
  id: number;
  block_id: string;
  tab: string;
  section: string | null;
  title: string | null;
  content: string | null;
  content_type: 'text' | 'html' | 'markdown' | 'json';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StrategyStats {
  checklistTotal: number;
  checklistCompleted: number;
  checklistPercentage: number;
  roadmapTotal: number;
  roadmapCompleted: number;
  roadmapInProgress: number;
  byCategory: Record<string, { total: number; completed: number }>;
  bySection: Record<string, { total: number; completed: number }>;
}

// ============ CHECKLIST HOOK ============

export function useStrategyChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('strategy_checklist_items')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setItems(data as ChecklistItem[]);
    } catch (err) {
      console.error('Error fetching checklist items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch checklist items');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleItem = useCallback(async (itemId: string) => {
    const item = items.find(i => i.item_id === itemId);
    if (!item) return;

    const newCompleted = !item.completed;
    const updates = {
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
    };

    // Optimistic update
    setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, ...updates } : i));

    const { error } = await supabase
      .from('strategy_checklist_items')
      .update(updates)
      .eq('item_id', itemId);

    if (error) {
      console.error('Error toggling item:', error);
      fetchItems(); // Revert on error
    }
  }, [items, fetchItems]);

  const addItem = useCallback(async (newItem: Partial<ChecklistItem>) => {
    const { data, error } = await supabase
      .from('strategy_checklist_items')
      .insert([{ ...newItem, completed: false }])
      .select()
      .single();

    if (error) throw error;
    setItems(prev => [...prev, data as ChecklistItem].sort((a, b) => a.sort_order - b.sort_order));
    return data as ChecklistItem;
  }, []);

  const updateItem = useCallback(async (itemId: string, updates: Partial<ChecklistItem>) => {
    const { error } = await supabase
      .from('strategy_checklist_items')
      .update(updates)
      .eq('item_id', itemId);

    if (error) throw error;
    setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, ...updates } : i));
  }, []);

  const deleteItem = useCallback(async (itemId: string) => {
    const { error } = await supabase
      .from('strategy_checklist_items')
      .delete()
      .eq('item_id', itemId);

    if (error) throw error;
    setItems(prev => prev.filter(i => i.item_id !== itemId));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return { items, loading, error, fetchItems, toggleItem, addItem, updateItem, deleteItem };
}

// ============ ROADMAP HOOK ============

export function useStrategyRoadmap() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('strategy_roadmap_items')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setItems((data || []).map(item => ({
        ...item,
        details: Array.isArray(item.details) ? item.details : JSON.parse(item.details || '[]')
      })) as RoadmapItem[]);
    } catch (err) {
      console.error('Error fetching roadmap items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch roadmap items');
    } finally {
      setLoading(false);
    }
  }, []);

  const addItem = useCallback(async (newItem: Partial<RoadmapItem>) => {
    const { data, error } = await supabase
      .from('strategy_roadmap_items')
      .insert([{
        ...newItem,
        details: JSON.stringify(newItem.details || [])
      }])
      .select()
      .single();

    if (error) throw error;
    const parsed = { ...data, details: JSON.parse(data.details || '[]') } as RoadmapItem;
    setItems(prev => [...prev, parsed].sort((a, b) => a.sort_order - b.sort_order));
    return parsed;
  }, []);

  const updateItem = useCallback(async (itemId: string, updates: Partial<RoadmapItem>) => {
    const payload = updates.details 
      ? { ...updates, details: JSON.stringify(updates.details) }
      : updates;

    const { error } = await supabase
      .from('strategy_roadmap_items')
      .update(payload)
      .eq('item_id', itemId);

    if (error) throw error;
    setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, ...updates } : i));
  }, []);

  const deleteItem = useCallback(async (itemId: string) => {
    const { error } = await supabase
      .from('strategy_roadmap_items')
      .delete()
      .eq('item_id', itemId);

    if (error) throw error;
    setItems(prev => prev.filter(i => i.item_id !== itemId));
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return { items, loading, error, fetchItems, addItem, updateItem, deleteItem };
}

// ============ TIMELINE HOOK ============

export function useStrategyTimeline() {
  const [milestones, setMilestones] = useState<TimelineMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMilestones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('strategy_timeline_milestones')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setMilestones((data || []).map(m => ({
        ...m,
        items: Array.isArray(m.items) ? m.items : JSON.parse(m.items || '[]')
      })) as TimelineMilestone[]);
    } catch (err) {
      console.error('Error fetching timeline:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch timeline');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateMilestone = useCallback(async (monthKey: string, updates: Partial<TimelineMilestone>) => {
    const payload = updates.items 
      ? { ...updates, items: JSON.stringify(updates.items) }
      : updates;

    const { error } = await supabase
      .from('strategy_timeline_milestones')
      .update(payload)
      .eq('month_key', monthKey);

    if (error) throw error;
    setMilestones(prev => prev.map(m => m.month_key === monthKey ? { ...m, ...updates } : m));
  }, []);

  const addMilestoneItem = useCallback(async (monthKey: string, item: string) => {
    const milestone = milestones.find(m => m.month_key === monthKey);
    if (!milestone) return;

    const newItems = [...milestone.items, item];
    await updateMilestone(monthKey, { items: newItems });
  }, [milestones, updateMilestone]);

  const removeMilestoneItem = useCallback(async (monthKey: string, itemIndex: number) => {
    const milestone = milestones.find(m => m.month_key === monthKey);
    if (!milestone) return;

    const newItems = milestone.items.filter((_, i) => i !== itemIndex);
    await updateMilestone(monthKey, { items: newItems });
  }, [milestones, updateMilestone]);

  const updateMilestoneItem = useCallback(async (monthKey: string, itemIndex: number, newValue: string) => {
    const milestone = milestones.find(m => m.month_key === monthKey);
    if (!milestone) return;

    const newItems = [...milestone.items];
    newItems[itemIndex] = newValue;
    await updateMilestone(monthKey, { items: newItems });
  }, [milestones, updateMilestone]);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  return { 
    milestones, 
    loading, 
    error, 
    fetchMilestones, 
    updateMilestone, 
    addMilestoneItem, 
    removeMilestoneItem,
    updateMilestoneItem 
  };
}

// ============ CONTENT BLOCKS HOOK ============

export function useStrategyContent() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('strategy_content_blocks')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setBlocks(data as ContentBlock[]);
    } catch (err) {
      console.error('Error fetching content blocks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch content');
    } finally {
      setLoading(false);
    }
  }, []);

  const getBlock = useCallback((blockId: string) => {
    return blocks.find(b => b.block_id === blockId);
  }, [blocks]);

  const getBlocksByTab = useCallback((tab: string) => {
    return blocks.filter(b => b.tab === tab);
  }, [blocks]);

  const updateBlock = useCallback(async (blockId: string, updates: Partial<ContentBlock>) => {
    const { error } = await supabase
      .from('strategy_content_blocks')
      .update(updates)
      .eq('block_id', blockId);

    if (error) throw error;
    setBlocks(prev => prev.map(b => b.block_id === blockId ? { ...b, ...updates } : b));
  }, []);

  const addBlock = useCallback(async (newBlock: Partial<ContentBlock>) => {
    const { data, error } = await supabase
      .from('strategy_content_blocks')
      .insert([newBlock])
      .select()
      .single();

    if (error) throw error;
    setBlocks(prev => [...prev, data as ContentBlock].sort((a, b) => a.sort_order - b.sort_order));
    return data as ContentBlock;
  }, []);

  const deleteBlock = useCallback(async (blockId: string) => {
    const { error } = await supabase
      .from('strategy_content_blocks')
      .delete()
      .eq('block_id', blockId);

    if (error) throw error;
    setBlocks(prev => prev.filter(b => b.block_id !== blockId));
  }, []);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  return { blocks, loading, error, fetchBlocks, getBlock, getBlocksByTab, updateBlock, addBlock, deleteBlock };
}

// ============ COMBINED STATS ============

export function useStrategyStats(
  checklistItems: ChecklistItem[],
  roadmapItems: RoadmapItem[]
): StrategyStats {
  const checklistTotal = checklistItems.length;
  const checklistCompleted = checklistItems.filter(i => i.completed).length;
  const checklistPercentage = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;

  const roadmapTotal = roadmapItems.length;
  const roadmapCompleted = roadmapItems.filter(i => i.status === 'completed').length;
  const roadmapInProgress = roadmapItems.filter(i => i.status === 'in-progress').length;

  const byCategory: Record<string, { total: number; completed: number }> = {};
  const bySection: Record<string, { total: number; completed: number }> = {};

  checklistItems.forEach(item => {
    if (!byCategory[item.category]) byCategory[item.category] = { total: 0, completed: 0 };
    byCategory[item.category].total++;
    if (item.completed) byCategory[item.category].completed++;

    if (!bySection[item.section]) bySection[item.section] = { total: 0, completed: 0 };
    bySection[item.section].total++;
    if (item.completed) bySection[item.section].completed++;
  });

  return {
    checklistTotal,
    checklistCompleted,
    checklistPercentage,
    roadmapTotal,
    roadmapCompleted,
    roadmapInProgress,
    byCategory,
    bySection,
  };
}
