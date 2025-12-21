import { useState } from 'react';
import { CartItem } from '@/hooks/useOrders';
import { RestaurantTable } from '@/hooks/useTables';
import { X, Banknote, CreditCard, QrCode, Printer, Check, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  tables: RestaurantTable[];
  selectedTable: string | null;
  onSelectTable: (tableId: string | null) => void;
  onComplete: (paymentMethod: 'cash' | 'transfer' | 'qris', amountPaid: number) => void;
}

const quickCashOptions = [20000, 50000, 100000, 200000];

export function CheckoutDialog({
  isOpen,
  onClose,
  items,
  total,
  tables,
  selectedTable,
  onSelectTable,
  onComplete,
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(total);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const change = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;

  const handleComplete = () => {
    if (paymentMethod === 'cash' && amountPaid < total) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsComplete(true);
      setTimeout(() => {
        onComplete(paymentMethod, paymentMethod === 'cash' ? amountPaid : total);
        setIsComplete(false);
        setAmountPaid(0);
        setPaymentMethod('cash');
      }, 1500);
    }, 1000);
  };

  const handleQuickCash = (amount: number) => {
    setAmountPaid(amount);
  };

  const handleExactAmount = () => {
    setAmountPaid(total);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-xl font-bold">Pembayaran</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Table Selection */}
          <div>
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4" />
              Pilih Meja (Opsional)
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => onSelectTable(null)}
                className={cn(
                  "py-3 rounded-lg text-sm font-medium transition-all active:scale-95",
                  selectedTable === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                Bawa
              </button>
              {tables
                .filter(t => t.status === 'available' || t.id === selectedTable)
                .slice(0, 7)
                .map((table) => (
                  <button
                    key={table.id}
                    onClick={() => onSelectTable(table.id)}
                    className={cn(
                      "py-3 rounded-lg text-sm font-medium transition-all active:scale-95",
                      selectedTable === table.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    #{table.table_number}
                  </button>
                ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-secondary/50 rounded-xl p-4 space-y-2 max-h-40 overflow-y-auto no-scrollbar">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between py-3 border-y border-border">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold text-primary">{formatPrice(total)}</span>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setPaymentMethod('cash');
                setAmountPaid(total);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-4 rounded-xl font-semibold transition-all active:scale-95",
                paymentMethod === 'cash'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              <Banknote className="w-5 h-5" />
              <span className="text-sm">Tunai</span>
            </button>
            <button
              onClick={() => {
                setPaymentMethod('transfer');
                setAmountPaid(total);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-4 rounded-xl font-semibold transition-all active:scale-95",
                paymentMethod === 'transfer'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-sm">Transfer</span>
            </button>
            <button
              onClick={() => {
                setPaymentMethod('qris');
                setAmountPaid(total);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-4 rounded-xl font-semibold transition-all active:scale-95",
                paymentMethod === 'qris'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              <QrCode className="w-5 h-5" />
              <span className="text-sm">QRIS</span>
            </button>
          </div>

          {/* Cash Options */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {quickCashOptions.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleQuickCash(amount)}
                    className={cn(
                      "py-3 rounded-lg text-sm font-medium transition-all active:scale-95",
                      amountPaid === amount
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {formatPrice(amount).replace('Rp', '')}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExactAmount}
                className={cn(
                  "w-full py-3 rounded-lg font-medium transition-all active:scale-95",
                  amountPaid === total
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                Uang Pas
              </button>

              {/* Custom Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Jumlah Uang Custom</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                  <input
                    type="number"
                    value={amountPaid || ''}
                    onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                    placeholder="Masukkan jumlah..."
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-right font-medium"
                  />
                </div>
              </div>

              {/* Change */}
              {change > 0 && (
                <div className="flex items-center justify-between p-4 bg-success/10 rounded-xl border border-success/20">
                  <span className="text-success font-medium">Kembalian</span>
                  <span className="text-success font-bold text-xl">{formatPrice(change)}</span>
                </div>
              )}
            </div>
          )}

          {/* Complete Button */}
          <button
            onClick={handleComplete}
            disabled={
              (paymentMethod === 'cash' && amountPaid < total) ||
              isProcessing ||
              isComplete
            }
            className={cn(
              "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95",
              isComplete
                ? "bg-success text-success-foreground"
                : (paymentMethod !== 'cash' || amountPaid >= total)
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isProcessing ? (
              <div className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : isComplete ? (
              <>
                <Check className="w-5 h-5" />
                Selesai!
              </>
            ) : (
              <>
                <Printer className="w-5 h-5" />
                Cetak Struk
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
