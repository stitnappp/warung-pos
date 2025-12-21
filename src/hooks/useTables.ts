import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type TableStatus = 'available' | 'occupied' | 'reserved';

export interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  status: TableStatus;
  current_order_id: string | null;
}

export function useTables() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number');

      if (error) throw error;
      setTables(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching tables');
    } finally {
      setLoading(false);
    }
  };

  const updateTableStatus = async (id: string, status: TableStatus, orderId?: string | null) => {
    const updates: Partial<RestaurantTable> = { status };
    if (orderId !== undefined) {
      updates.current_order_id = orderId;
    }

    const { data, error } = await supabase
      .from('restaurant_tables')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setTables(prev => prev.map(table => table.id === id ? data : table));
    return data;
  };

  const addTable = async (tableNumber: number, capacity: number) => {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .insert({ table_number: tableNumber, capacity })
      .select()
      .single();

    if (error) throw error;
    setTables(prev => [...prev, data]);
    return data;
  };

  const deleteTable = async (id: string) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setTables(prev => prev.filter(table => table.id !== id));
  };

  useEffect(() => {
    fetchTables();
  }, []);

  return {
    tables,
    loading,
    error,
    refetch: fetchTables,
    updateTableStatus,
    addTable,
    deleteTable,
  };
}
