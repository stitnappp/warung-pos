import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type OrderStatus = 'pending' | 'completed' | 'cancelled';
type PaymentMethod = 'cash' | 'transfer' | 'qris';

export type Order = Tables<'orders'> & {
  order_items?: Tables<'order_items'>[];
};

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchTodayOrders = async (filterByCashier: boolean = false, role?: string | null) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    // Filter by cashier_id if not admin
    if (filterByCashier && role !== 'admin' && user?.id) {
      query = query.eq('cashier_id', user.id);
    }

    const { data, error } = await query;

    if (error) throw error;
    setTodayOrders(data || []);
    return data;
  };

  const fetchOrders = async (startDate?: Date, endDate?: Date) => {
    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    setOrders(data || []);
    return data;
  };

  const createOrder = async (
    cart: CartItem[],
    tableId: string | null,
    paymentMethod: PaymentMethod,
    amountPaid: number,
    discount: number = 0,
    notes?: string,
    cashierName?: string
  ) => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = subtotal - discount;
    const changeAmount = amountPaid - total;

    // Generate order number client-side since trigger requires it
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        table_id: tableId,
        cashier_id: user?.id,
        cashier_name: cashierName,
        status: 'completed' as OrderStatus,
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        change_amount: changeAmount,
        notes,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems: TablesInsert<'order_items'>[] = cart.map(item => ({
      order_id: order.id,
      menu_item_id: item.id,
      menu_item_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // Update table status if applicable
    if (tableId) {
      await supabase
        .from('restaurant_tables')
        .update({ status: 'available' as const, current_order_id: null })
        .eq('id', tableId);
    }

    // Send WhatsApp notification to admin (fire and forget)
    try {
      supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          orderNumber: order.order_number,
          total: order.total,
          cashierName: cashierName || 'Unknown',
          paymentMethod: paymentMethod
        }
      }).then(response => {
        console.log('WhatsApp notification response:', response);
      }).catch(err => {
        console.error('WhatsApp notification error:', err);
      });
    } catch (notifError) {
      console.error('Failed to send WhatsApp notification:', notifError);
    }

    await fetchTodayOrders();
    return order;
  };

  const getTodayStats = () => {
    const completedOrders = todayOrders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const cashRevenue = completedOrders
      .filter(o => o.payment_method === 'cash')
      .reduce((sum, o) => sum + o.total, 0);
    const transferRevenue = completedOrders
      .filter(o => o.payment_method === 'transfer')
      .reduce((sum, o) => sum + o.total, 0);
    const qrisRevenue = completedOrders
      .filter(o => o.payment_method === 'qris')
      .reduce((sum, o) => sum + o.total, 0);

    return {
      totalOrders: completedOrders.length,
      totalRevenue,
      cashRevenue,
      transferRevenue,
      qrisRevenue,
    };
  };

  useEffect(() => {
    setLoading(true);
    fetchTodayOrders().finally(() => setLoading(false));
  }, []);

  return {
    orders,
    todayOrders,
    loading,
    fetchOrders,
    fetchTodayOrders,
    createOrder,
    getTodayStats,
  };
}
