import { Order } from '@/hooks/useOrders';
import { X, Receipt, Clock, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { printReceipt, formatPrice } from '@/utils/receiptPrinter';
import { useAuth } from '@/contexts/AuthContext';

interface OrderHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

export function OrderHistory({ isOpen, onClose, orders }: OrderHistoryProps) {
  const { fullName } = useAuth();

  const formatTime = (dateString: string) => {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const handlePrint = (order: Order) => {
    const items = order.order_items?.map(item => ({
      id: item.menu_item_id || item.id,
      name: item.menu_item_name,
      price: item.unit_price,
      quantity: item.quantity,
    })) || [];

    printReceipt({
      orderNumber: order.order_number,
      cashierName: fullName || 'Kasir',
      items,
      subtotal: order.subtotal,
      discount: order.discount || 0,
      total: order.total,
      paymentMethod: order.payment_method || 'cash',
      amountPaid: order.amount_paid || order.total,
      change: order.change_amount || 0,
      timestamp: new Date(order.created_at),
    });
  };

  if (!isOpen) return null;

  const todayTotal = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl max-h-[80vh] bg-card rounded-2xl border border-border shadow-2xl animate-scale-in overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Riwayat Transaksi</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 bg-primary/10 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Hari Ini</span>
            <span className="text-2xl font-bold text-primary">{formatPrice(todayTotal)}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.filter(o => o.status === 'completed').length} transaksi
          </p>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Receipt className="w-12 h-12 mb-3 opacity-30" />
              <p>Belum ada transaksi hari ini</p>
            </div>
          ) : (
            orders.map((order, index) => (
              <div
                key={order.id}
                className={cn(
                  "p-4 bg-secondary/50 rounded-xl animate-slide-in-right"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      #{order.order_number}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        order.payment_method === 'cash'
                          ? "bg-accent/20 text-accent"
                          : order.payment_method === 'qris'
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-primary/20 text-primary"
                      )}
                    >
                      {order.payment_method === 'cash'
                        ? 'Tunai'
                        : order.payment_method === 'qris'
                        ? 'QRIS'
                        : 'Transfer'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Clock className="w-4 h-4" />
                      {formatTime(order.created_at)}
                    </div>
                    <button
                      onClick={() => handlePrint(order)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      title="Cetak ulang struk"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.menu_item_name}
                      </span>
                      <span>{formatPrice(item.total_price)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary">{formatPrice(order.total)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
