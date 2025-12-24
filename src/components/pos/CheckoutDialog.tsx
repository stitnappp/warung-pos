import { useState, useEffect } from 'react';
import { CartItem } from '@/hooks/useOrders';
import { RestaurantTable } from '@/hooks/useTables';
import { X, Banknote, CreditCard, QrCode, Printer, MapPin, ArrowLeft, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { printReceipt as webPrintReceipt } from '@/utils/receiptPrinter';
import { useAuth } from '@/contexts/AuthContext';
import { useRestaurantSettings } from '@/hooks/useRestaurantSettings';

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
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    paymentMethod: 'cash' | 'transfer' | 'qris';
    amountPaid: number;
    change: number;
  } | null>(null);

  // QRIS states
  const [qrisData, setQrisData] = useState<{
    qrCodeUrl: string | null;
    qrString: string | null;
    orderId: string | null;
    expiryTime: string | null;
  } | null>(null);
  const [showQrisPayment, setShowQrisPayment] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [qrisGenerating, setQrisGenerating] = useState(false);

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

  // Generate unique order ID for QRIS
  const generateOrderId = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `QRIS-${timestamp}-${random}`;
  };

  // Create QRIS payment
  const handleCreateQrisPayment = async () => {
    setQrisGenerating(true);
    try {
      const orderId = generateOrderId();
      const itemDetails = items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.functions.invoke('create-qris-payment', {
        body: {
          order_id: orderId,
          amount: total,
          item_details: itemDetails,
        },
      });

      if (error) {
        console.error('Error creating QRIS payment:', error);
        toast({
          title: 'Error',
          description: 'Gagal membuat pembayaran QRIS. Silakan coba lagi.',
          variant: 'destructive',
        });
        return;
      }

      if (data.error) {
        console.error('QRIS payment error:', data.error);
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      setQrisData({
        qrCodeUrl: data.qr_code_url,
        qrString: data.qr_string,
        orderId: data.order_id,
        expiryTime: data.expiry_time,
      });
      setShowQrisPayment(true);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan. Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setQrisGenerating(false);
    }
  };

  // Check payment status
  const checkPaymentStatus = async () => {
    if (!qrisData?.orderId) return;

    setCheckingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { order_id: qrisData.orderId },
      });

      if (error) {
        console.error('Error checking payment status:', error);
        toast({
          title: 'Error',
          description: 'Gagal memeriksa status pembayaran.',
          variant: 'destructive',
        });
        return;
      }

      if (data.status === 'success') {
        // Payment successful!
        toast({
          title: 'Pembayaran Berhasil!',
          description: 'Pembayaran QRIS telah diterima.',
        });
        setReceiptData({
          paymentMethod: 'qris',
          amountPaid: total,
          change: 0,
        });
        setShowQrisPayment(false);
        setShowReceipt(true);
      } else if (data.status === 'pending') {
        toast({
          title: 'Menunggu Pembayaran',
          description: 'Pembayaran masih dalam proses. Silakan scan QR code.',
        });
      } else if (data.status === 'failed') {
        toast({
          title: 'Pembayaran Gagal',
          description: 'Pembayaran QRIS gagal atau expired.',
          variant: 'destructive',
        });
        setShowQrisPayment(false);
        setQrisData(null);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCheckingPayment(false);
    }
  };

  // Auto-check payment status every 5 seconds when QRIS is shown
  useEffect(() => {
    if (!showQrisPayment || !qrisData?.orderId) return;

    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [showQrisPayment, qrisData?.orderId]);

  const handleComplete = async () => {
    if (paymentMethod === 'qris') {
      handleCreateQrisPayment();
      return;
    }

    if (paymentMethod === 'cash' && amountPaid < total) return;

    setIsProcessing(true);
    
    const tableNum = selectedTable ? tables.find(t => t.id === selectedTable)?.table_number : undefined;
    const finalAmountPaid = paymentMethod === 'cash' ? amountPaid : total;
    const change = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;

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
      change: change,
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
      change: change,
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
    setQrisData(null);
    setShowQrisPayment(false);
  };

  const handleCancelQris = () => {
    setShowQrisPayment(false);
    setQrisData(null);
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
      setQrisData(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  // QRIS Payment View
  if (showQrisPayment && qrisData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
            <h2 className="text-xl font-bold">Pembayaran QRIS</h2>
            <button
              onClick={handleCancelQris}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-xl shadow-lg">
                {qrisData.qrCodeUrl ? (
                  <img 
                    src={qrisData.qrCodeUrl} 
                    alt="QRIS QR Code" 
                    className="w-64 h-64 object-contain"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                    <span className="text-muted-foreground text-sm">QR Code tidak tersedia</span>
                  </div>
                )}
              </div>

              <div className="text-center space-y-2">
                <p className="text-2xl font-bold text-primary">{formatPrice(total)}</p>
                <p className="text-sm text-muted-foreground">
                  Scan QR code di atas menggunakan aplikasi e-wallet
                </p>
                {qrisData.expiryTime && (
                  <p className="text-xs text-muted-foreground">
                    Berlaku sampai: {new Date(qrisData.expiryTime).toLocaleTimeString('id-ID')}
                  </p>
                )}
              </div>
            </div>

            {/* Payment Status Indicator */}
            <div className="flex items-center justify-center gap-2 p-4 bg-secondary/50 rounded-xl">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Menunggu pembayaran...</span>
            </div>

            {/* Check Payment Button */}
            <button
              onClick={checkPaymentStatus}
              disabled={checkingPayment}
              className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
            >
              {checkingPayment ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              Cek Status Pembayaran
            </button>

            {/* Cancel Button */}
            <button
              onClick={handleCancelQris}
              className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-muted text-muted-foreground hover:bg-muted/80 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
              Kembali
            </button>
          </div>
        </div>
      </div>
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
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-success" />
              </div>
              <h3 className="text-xl font-bold text-success">Pembayaran Berhasil!</h3>
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
                        <span className="font-bold text-success">{formatPrice(receiptData.change)}</span>
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

          {/* QRIS Info */}
          {paymentMethod === 'qris' && (
            <div className="p-4 bg-secondary/50 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                <span className="font-medium">Pembayaran QRIS</span>
              </div>
              <p className="text-sm text-muted-foreground">
                QR code akan dibuat otomatis setelah Anda menekan tombol di bawah. Customer dapat scan menggunakan GoPay, OVO, DANA, ShopeePay, dan aplikasi e-wallet lainnya.
              </p>
            </div>
          )}

          {/* Complete Button */}
          <button
            onClick={handleComplete}
            disabled={
              (paymentMethod === 'cash' && amountPaid < total) ||
              isProcessing ||
              qrisGenerating
            }
            className={cn(
              "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95",
              isProcessing || qrisGenerating
                ? "bg-primary/70 text-primary-foreground"
                : (paymentMethod !== 'cash' || amountPaid >= total)
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isProcessing || qrisGenerating ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : paymentMethod === 'qris' ? (
              <>
                <QrCode className="w-5 h-5" />
                Buat QR Code
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
