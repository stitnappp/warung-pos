import { useState, useEffect } from 'react';
import { CartItem } from '@/hooks/useOrders';
import { RestaurantTable } from '@/hooks/useTables';
import { X, Banknote, CreditCard, QrCode, MapPin, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { printReceipt as webPrintReceipt } from '@/utils/receiptPrinter';
import { useAuth } from '@/contexts/AuthContext';
import { useRestaurantSettings } from '@/hooks/useRestaurantSettings';
import { QrisPaymentDialog } from './QrisPaymentDialog';

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

const paymentMethods = [
  { id: 'cash' as const, label: 'Tunai', icon: Banknote },
  { id: 'qris' as const, label: 'QRIS', icon: QrCode },
  { id: 'transfer' as const, label: 'Transfer', icon: CreditCard },
];

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
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    paymentMethod: 'cash' | 'transfer' | 'qris';
    amountPaid: number;
    change: number;
  } | null>(null);

  // QRIS states
  const [showQrisPayment, setShowQrisPayment] = useState(false);
  const [tempOrderId, setTempOrderId] = useState('');

  // Bluetooth printer hook
  const bluetoothPrinter = useBluetoothPrinter();
  const { fullName } = useAuth();
  const { settings: restaurantSettings } = useRestaurantSettings();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const change = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;
  const isCashPayment = paymentMethod === 'cash';
  const isQrisPayment = paymentMethod === 'qris';
  const canConfirm = !isCashPayment || amountPaid >= total;

  // Reset received amount when dialog opens or total changes
  useEffect(() => {
    if (isOpen) {
      setAmountPaid(total);
      setShowQrisPayment(false);
      // Generate a temporary order ID for QRIS
      setTempOrderId(crypto.randomUUID());
    }
  }, [isOpen, total]);

  const handleComplete = async () => {
    if (paymentMethod === 'qris') {
      setShowQrisPayment(true);
      return;
    }

    if (paymentMethod === 'cash' && amountPaid < total) return;

    setIsProcessing(true);
    
    const tableNum = selectedTable ? tables.find(t => t.id === selectedTable)?.table_number : undefined;
    const finalAmountPaid = paymentMethod === 'cash' ? amountPaid : total;
    const changeAmount = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;

    // Build receipt data
    const receiptPrintData = {
      orderNumber: `ORD-${Date.now()}`,
      cashierName: fullName || 'Kasir',
      tableNumber: tableNum,
      items: items,
      subtotal: total,
      discount: 0,
      total: total,
      paymentMethod,
      amountPaid: finalAmountPaid,
      change: changeAmount,
      timestamp: new Date(),
      restaurantSettings: restaurantSettings ? {
        restaurant_name: restaurantSettings.restaurant_name,
        address_line1: restaurantSettings.address_line1,
        address_line2: restaurantSettings.address_line2,
        address_line3: restaurantSettings.address_line3,
        whatsapp_number: restaurantSettings.whatsapp_number,
        instagram_handle: restaurantSettings.instagram_handle,
        footer_message: restaurantSettings.footer_message,
      } : undefined,
    };

    // Print receipt immediately using Bluetooth printer if connected
    try {
      if (bluetoothPrinter.isNative && bluetoothPrinter.isConnected) {
        const btSuccess = await bluetoothPrinter.printReceipt(receiptPrintData);
        if (!btSuccess) {
          // Fallback to web print if Bluetooth fails
          webPrintReceipt(receiptPrintData);
        }
      } else {
        webPrintReceipt(receiptPrintData);
      }
    } catch (error) {
      console.error('Print error:', error);
      webPrintReceipt(receiptPrintData);
    }

    setIsProcessing(false);
    setReceiptData({
      paymentMethod,
      amountPaid: finalAmountPaid,
      change: changeAmount,
    });
    setShowReceipt(true);
  };

  const handleQrisPaymentSuccess = async () => {
    setShowQrisPayment(false);
    
    const tableNum = selectedTable ? tables.find(t => t.id === selectedTable)?.table_number : undefined;

    // Build receipt data
    const receiptPrintData = {
      orderNumber: `ORD-${Date.now()}`,
      cashierName: fullName || 'Kasir',
      tableNumber: tableNum,
      items: items,
      subtotal: total,
      discount: 0,
      total: total,
      paymentMethod: 'qris' as const,
      amountPaid: total,
      change: 0,
      timestamp: new Date(),
      restaurantSettings: restaurantSettings ? {
        restaurant_name: restaurantSettings.restaurant_name,
        address_line1: restaurantSettings.address_line1,
        address_line2: restaurantSettings.address_line2,
        address_line3: restaurantSettings.address_line3,
        whatsapp_number: restaurantSettings.whatsapp_number,
        instagram_handle: restaurantSettings.instagram_handle,
        footer_message: restaurantSettings.footer_message,
      } : undefined,
    };

    // Print receipt
    try {
      if (bluetoothPrinter.isNative && bluetoothPrinter.isConnected) {
        const btSuccess = await bluetoothPrinter.printReceipt(receiptPrintData);
        if (!btSuccess) {
          webPrintReceipt(receiptPrintData);
        }
      } else {
        webPrintReceipt(receiptPrintData);
      }
    } catch (error) {
      console.error('Print error:', error);
      webPrintReceipt(receiptPrintData);
    }

    setReceiptData({
      paymentMethod: 'qris',
      amountPaid: total,
      change: 0,
    });
    setShowReceipt(true);
  };

  const handleBackToMenu = () => {
    if (receiptData) {
      onComplete(receiptData.paymentMethod, receiptData.amountPaid);
    }
    // Reset all states
    setShowReceipt(false);
    setReceiptData(null);
    setAmountPaid(0);
    setPaymentMethod('cash');
    setShowQrisPayment(false);
  };

  const handleQuickCash = (amount: number) => {
    setAmountPaid(amount);
  };

  const handleExactAmount = () => {
    setAmountPaid(total);
  };

  // Reset states when dialog closes
  const handleClose = () => {
    if (!showReceipt && !showQrisPayment) {
      setAmountPaid(0);
      setPaymentMethod('cash');
      onClose();
    }
  };

  if (!isOpen) return null;

  // QRIS Payment Dialog
  if (showQrisPayment) {
    return (
      <QrisPaymentDialog
        open={showQrisPayment}
        onClose={() => setShowQrisPayment(false)}
        onPaymentSuccess={handleQrisPaymentSuccess}
        orderId={tempOrderId}
        total={total}
        customerName={fullName || undefined}
        cart={items}
      />
    );
  }

  // Receipt View
  if (showReceipt && receiptData) {
    const tableNum = selectedTable ? tables.find(t => t.id === selectedTable)?.table_number : null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-center p-4 border-b border-border sticky top-0 bg-card z-10">
            <h2 className="text-xl font-bold">Struk Pembayaran</h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Success Icon */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-green-500">Pembayaran Berhasil!</h3>
              <p className="text-sm text-muted-foreground text-center">
                Struk telah dicetak ke printer
              </p>
            </div>

            {/* Receipt Details */}
            <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
              {/* Table */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Meja</span>
                <span className="font-medium">{tableNum ? `#${tableNum}` : 'Bawa Pulang'}</span>
              </div>

              {/* Items */}
              <div className="border-t border-border pt-3 space-y-2">
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
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Metode Pembayaran</span>
                  <span className="font-medium capitalize">
                    {receiptData.paymentMethod === 'cash' ? 'Tunai' : 
                     receiptData.paymentMethod === 'transfer' ? 'Transfer' : 'QRIS'}
                  </span>
                </div>
                {receiptData.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Dibayar</span>
                      <span className="font-medium">{formatPrice(receiptData.amountPaid)}</span>
                    </div>
                    {receiptData.change > 0 && (
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-muted-foreground">Kembalian</span>
                        <span className="font-bold text-green-500">{formatPrice(receiptData.change)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Back to Menu Button */}
            <button
              onClick={handleBackToMenu}
              className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
              Kembali ke Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-xl font-bold">Pembayaran</h2>
          <button
            onClick={handleClose}
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onSelectTable(null)}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium text-sm transition-all",
                  selectedTable === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Bawa Pulang
              </button>
              {tables.filter(t => t.status === 'available').map((table) => (
                <button
                  key={table.id}
                  onClick={() => onSelectTable(table.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium text-sm transition-all",
                    selectedTable === table.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  Meja {table.table_number}
                </button>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Ringkasan Pesanan</h4>
            {items.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name} x{item.quantity}
                </span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Metode Pembayaran</label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(method => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                      paymentMethod === method.id
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* QRIS Info */}
          {isQrisPayment && (
            <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
              <div className="flex items-center gap-3">
                <QrCode className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-sm">Pembayaran QRIS</p>
                  <p className="text-xs text-muted-foreground">
                    QR code akan ditampilkan setelah konfirmasi
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cash Payment - Received Amount */}
          {isCashPayment && (
            <div className="space-y-3 p-4 bg-secondary/50 rounded-xl">
              <div className="space-y-2">
                <label className="text-sm font-medium">Uang Diterima *</label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  placeholder="Masukkan jumlah uang..."
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  min={0}
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExactAmount}
                  className="px-3 py-2 text-xs font-medium bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Uang Pas
                </button>
                {quickCashOptions.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleQuickCash(amount)}
                    className="px-3 py-2 text-xs font-medium bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
              </div>

              {/* Change Amount Display */}
              {amountPaid > 0 && (
                <div className={cn(
                  "p-4 rounded-xl text-center",
                  change >= 0 ? "bg-green-500/10" : "bg-destructive/10"
                )}>
                  <p className="text-sm text-muted-foreground">Kembalian</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    change >= 0 ? "text-green-500" : "text-destructive"
                  )}>
                    {change >= 0 ? formatPrice(change) : `Kurang ${formatPrice(Math.abs(change))}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={handleComplete}
            disabled={isProcessing || !canConfirm}
            className={cn(
              "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95",
              canConfirm
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : null}
            {isProcessing ? 'Memproses...' : isQrisPayment ? 'Tampilkan QRIS' : 'Konfirmasi & Cetak Struk'}
          </button>
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-muted text-muted-foreground hover:bg-muted/80 transition-all active:scale-95"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
