import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, BellRing, Check, CreditCard, Smartphone, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';

interface PaymentNotification {
  id: string;
  order_id: string;
  transaction_id: string | null;
  payment_type: string;
  transaction_status: string;
  gross_amount: number;
  currency: string;
  transaction_time: string | null;
  is_read: boolean;
  created_at: string;
}

export const PaymentNotifications = () => {
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('payment_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
    setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('payment-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payment_notifications',
        },
        (payload) => {
          console.log('New payment notification:', payload);
          const newNotification = payload.new as PaymentNotification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          
          // Show toast notification
          toast.success('Pembayaran Masuk!', {
            description: `${getPaymentTypeLabel(newNotification.payment_type)} - Rp ${newNotification.gross_amount.toLocaleString('id-ID')}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('payment_notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error('Error marking as read:', error);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('payment_notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all as read:', error);
      return;
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const getPaymentTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      qris: 'QRIS',
      bank_transfer: 'Transfer Bank',
      gopay: 'GoPay',
      shopeepay: 'ShopeePay',
      credit_card: 'Kartu Kredit',
      echannel: 'Mandiri Bill',
      bca_va: 'BCA Virtual Account',
      bni_va: 'BNI Virtual Account',
      bri_va: 'BRI Virtual Account',
      permata_va: 'Permata Virtual Account',
    };
    return types[type] || type;
  };

  const getPaymentIcon = (type: string) => {
    if (type === 'qris' || type.includes('pay')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (type.includes('bank') || type.includes('va') || type === 'echannel') {
      return <Building2 className="h-4 w-4" />;
    }
    return <CreditCard className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifikasi Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Memuat...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {unreadCount > 0 ? (
              <BellRing className="h-5 w-5 text-primary animate-pulse" />
            ) : (
              <Bell className="h-5 w-5" />
            )}
            Notifikasi Pembayaran
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="h-4 w-4 mr-1" />
              Tandai Semua Dibaca
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada notifikasi pembayaran</p>
            <p className="text-sm mt-2">
              Notifikasi akan muncul saat ada pembayaran masuk via QRIS atau Transfer
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition-colors ${
                  notification.is_read
                    ? 'bg-background'
                    : 'bg-primary/5 border-primary/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      notification.is_read ? 'bg-muted' : 'bg-primary/10'
                    }`}>
                      {getPaymentIcon(notification.payment_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getPaymentTypeLabel(notification.payment_type)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {notification.transaction_status}
                        </Badge>
                      </div>
                      <p className="text-lg font-semibold text-primary">
                        Rp {notification.gross_amount.toLocaleString('id-ID')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Order: {notification.order_id}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: id,
                        })}
                      </p>
                    </div>
                  </div>
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(notification.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
