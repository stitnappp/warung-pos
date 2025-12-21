import { CartItem } from '@/hooks/useOrders';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
  onClear: () => void;
}

export function CartPanel({ items, onUpdateQuantity, onRemoveItem, onCheckout, onClear }: CartPanelProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Pesanan</h2>
          {totalItems > 0 && (
            <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
              {totalItems}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="text-destructive hover:text-destructive/80 text-sm font-medium transition-colors"
          >
            Hapus Semua
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Belum ada pesanan</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 bg-secondary/50 rounded-lg animate-slide-in-right"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{item.name}</h4>
                <p className="text-primary font-semibold text-sm">
                  {formatPrice(item.price)}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors active:scale-95"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-bold">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors active:scale-95 ml-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-bold text-xl text-foreground">{formatPrice(subtotal)}</span>
        </div>

        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className={cn(
            "w-full py-4 rounded-xl font-bold text-lg transition-all duration-200",
            "active:scale-95 touch-action-pan-y",
            items.length > 0
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 animate-pulse-glow"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          Bayar {formatPrice(subtotal)}
        </button>
      </div>
    </div>
  );
}
