import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, QrCode, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/hooks/useOrders';
import { cn } from '@/lib/utils';

interface QrisPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  orderId: string;
  total: number;
  customerName?: string;
  cart: CartItem[];
}

interface QrisResponse {
  success: boolean;
  transactionId?: string;
  orderId?: string;
  qrCodeUrl?: string;
  transactionStatus?: string;
  expiryTime?: string;
  error?: string;
}

type PaymentStatus = 'pending' | 'settlement' | 'capture' | 'expire' | 'cancel' | 'deny' | 'failure' | 'error';

export function QrisPaymentDialog({
  open,
  onClose,
  onPaymentSuccess,
  orderId,
  total,
  customerName,
  cart,
}: QrisPaymentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [qrisData, setQrisData] = useState<QrisResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const generateQris = useCallback(async () => {
    setIsLoading(true);
    setQrisData(null);
    setPaymentStatus('pending');

    try {
      const { data, error } = await supabase.functions.invoke('midtrans-qris', {
        body: {
          orderId: `ORDER-${orderId.slice(-8)}-${Date.now()}`,
          grossAmount: total,
          customerName: customerName || 'Customer',
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      });

      if (error) {
        console.error('QRIS generation error:', error);
        toast.error('Gagal membuat QRIS. Pastikan Midtrans sudah dikonfigurasi.');
        setQrisData({ success: false, error: error.message });
        return;
      }

      if (data?.error) {
        console.error('QRIS API error:', data.error);
        toast.error(data.error);
        setQrisData({ success: false, error: data.error });
        return;
      }

      console.log('QRIS generated:', data);
      setQrisData(data);

      // Calculate time left if expiry time is provided
      if (data?.expiryTime) {
        const expiryDate = new Date(data.expiryTime);
        const now = new Date();
        const diffSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
        setTimeLeft(diffSeconds > 0 ? diffSeconds : 0);
      }
    } catch (error: unknown) {
      console.error('QRIS generation failed:', error);
      toast.error('Gagal membuat QRIS');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setQrisData({ success: false, error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, total, customerName, cart]);

  const checkPaymentStatus = useCallback(async () => {
    if (!qrisData?.orderId) return;

    setIsCheckingStatus(true);

    try {
      const { data, error } = await supabase.functions.invoke('midtrans-status', {
        body: { orderId: qrisData.orderId },
      });

      if (error) {
        console.error('Status check error:', error);
        return;
      }

      console.log('Payment status:', data);

      if (data?.transactionStatus) {
        setPaymentStatus(data.transactionStatus as PaymentStatus);

        if (data.transactionStatus === 'settlement' || data.transactionStatus === 'capture') {
          toast.success('Pembayaran berhasil!');
          onPaymentSuccess();
          onClose();
        } else if (data.transactionStatus === 'expire') {
          toast.error('QRIS sudah kadaluarsa');
        } else if (data.transactionStatus === 'cancel' || data.transactionStatus === 'deny') {
          toast.error('Pembayaran dibatalkan');
        }
      }
    } catch (error) {
      console.error('Status check failed:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  }, [qrisData?.orderId, onPaymentSuccess, onClose]);

  // Generate QRIS when dialog opens
  useEffect(() => {
    if (open && !qrisData && !isLoading) {
      generateQris();
    }
  }, [open, qrisData, isLoading, generateQris]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setQrisData(null);
      setPaymentStatus('pending');
      setTimeLeft(null);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Auto-check payment status every 5 seconds
  useEffect(() => {
    if (!open || !qrisData?.success || paymentStatus !== 'pending') return;

    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [open, qrisData?.success, paymentStatus, checkPaymentStatus]);

  const formatTimeLeft = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusDisplay = () => {
    switch (paymentStatus) {
      case 'settlement':
      case 'capture':
        return { icon: CheckCircle, text: 'Pembayaran Berhasil', color: 'text-green-500' };
      case 'expire':
        return { icon: Clock, text: 'QRIS Kadaluarsa', color: 'text-orange-500' };
      case 'cancel':
      case 'deny':
      case 'failure':
        return { icon: XCircle, text: 'Pembayaran Gagal', color: 'text-destructive' };
      default:
        return { icon: Clock, text: 'Menunggu Pembayaran', color: 'text-primary' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Pembayaran QRIS</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center p-6 space-y-6">
          {/* Total Amount */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Pembayaran</p>
            <p className="text-2xl font-bold text-primary">{formatPrice(total)}</p>
          </div>

          {/* QR Code Display */}
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Membuat QRIS...</p>
            </div>
          ) : qrisData?.success && qrisData?.qrCodeUrl ? (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-xl border-2 border-primary/20 shadow-lg">
                <img
                  src={qrisData.qrCodeUrl}
                  alt="QRIS Payment"
                  className="w-64 h-64 object-contain"
                />
              </div>

              {/* Timer */}
              {timeLeft !== null && timeLeft > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Berlaku {formatTimeLeft(timeLeft)}</span>
                </div>
              )}

              {/* Status */}
              <div className={cn("flex items-center gap-2", statusDisplay.color)}>
                <StatusIcon className="h-5 w-5" />
                <span className="font-medium">{statusDisplay.text}</span>
                {paymentStatus === 'pending' && isCheckingStatus && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Scan QR code di atas menggunakan aplikasi e-wallet atau mobile banking Anda
              </p>
            </div>
          ) : qrisData?.error ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm text-destructive">{qrisData.error}</p>
              <button
                onClick={generateQris}
                className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Coba Lagi
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 p-4 border-t border-border">
          {paymentStatus === 'pending' && qrisData?.success && (
            <button
              onClick={checkPaymentStatus}
              disabled={isCheckingStatus}
              className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
            >
              {isCheckingStatus ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
              Cek Status Pembayaran
            </button>
          )}

          {(paymentStatus === 'expire' || paymentStatus === 'cancel') && (
            <button
              onClick={generateQris}
              className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
            >
              <RefreshCw className="h-5 w-5" />
              Buat QRIS Baru
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-muted text-muted-foreground hover:bg-muted/80 transition-all active:scale-95"
          >
            {paymentStatus === 'pending' ? 'Batal' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
}
