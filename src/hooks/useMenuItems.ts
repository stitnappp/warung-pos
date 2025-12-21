import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MenuCategory {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  image_url: string | null;
  is_available: boolean;
}

export function useMenuItems() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [categoriesRes, itemsRes] = await Promise.all([
        supabase.from('menu_categories').select('*').order('sort_order'),
        supabase.from('menu_items').select('*').eq('is_available', true).order('name'),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(categoriesRes.data || []);
      setItems(itemsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching menu');
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (item: Omit<MenuItem, 'id'>) => {
    const { data, error } = await supabase
      .from('menu_items')
      .insert(item)
      .select()
      .single();
    
    if (error) throw error;
    setItems(prev => [...prev, data]);
    return data;
  };

  const updateItem = async (id: string, updates: Partial<MenuItem>) => {
    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    setItems(prev => prev.map(item => item.id === id ? data : item));
    return data;
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addCategory = async (category: Omit<MenuCategory, 'id'>) => {
    const { data, error } = await supabase
      .from('menu_categories')
      .insert(category)
      .select()
      .single();
    
    if (error) throw error;
    setCategories(prev => [...prev, data]);
    return data;
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    categories,
    items,
    loading,
    error,
    refetch: fetchData,
    addItem,
    updateItem,
    deleteItem,
    addCategory,
  };
}
