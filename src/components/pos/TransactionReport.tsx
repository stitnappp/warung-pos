import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, MessageCircle, FileText, TrendingUp, CreditCard, Banknote, QrCode, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/utils/receiptPrinter';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { DailyReportReminder } from './DailyReportReminder';

type Order = Tables<'orders'> & {
  order_items?: Tables<'order_items'>[];
};

type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

interface ReportStats {
  totalOrders: number;
  totalRevenue: number;
  cashRevenue: number;
  transferRevenue: number;
  qrisRevenue: number;
  averageOrder: number;
}

export function TransactionReport() {
  const { user, role } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  
  const isAdmin = role === 'admin';

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        return {
          start: customStartDate ? startOfDay(new Date(customStartDate)) : subDays(now, 7),
          end: customEndDate ? endOfDay(new Date(customEndDate)) : endOfDay(now),
        };
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      let query = supabase
        .from('orders')
        .select(`*, order_items (*)`)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      // Filter by cashier_id if not admin
      if (!isAdmin && user?.id) {
        query = query.eq('cashier_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Gagal mengambil data transaksi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [period, customStartDate, customEndDate, isAdmin, user?.id]);

  const calculateStats = (): ReportStats => {
    const completedOrders = orders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
    
    return {
      totalOrders: completedOrders.length,
      totalRevenue,
      cashRevenue: completedOrders.filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + o.total, 0),
      transferRevenue: completedOrders.filter(o => o.payment_method === 'transfer').reduce((sum, o) => sum + o.total, 0),
      qrisRevenue: completedOrders.filter(o => o.payment_method === 'qris').reduce((sum, o) => sum + o.total, 0),
      averageOrder: completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0,
    };
  };

  const stats = calculateStats();

  const getPeriodLabel = () => {
    const { start, end } = getDateRange();
    if (period === 'today') {
      return format(start, 'dd MMMM yyyy', { locale: idLocale });
    }
    return `${format(start, 'dd MMM', { locale: idLocale })} - ${format(end, 'dd MMM yyyy', { locale: idLocale })}`;
  };

  const generateReportText = () => {
    const { start, end } = getDateRange();
    const periodText = period === 'today' 
      ? format(start, 'dd MMMM yyyy', { locale: idLocale })
      : `${format(start, 'dd MMM', { locale: idLocale })} - ${format(end, 'dd MMM yyyy', { locale: idLocale })}`;

    let text = `📊 *LAPORAN TRANSAKSI*\n`;
    text += `📅 Periode: ${periodText}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    text += `📈 *RINGKASAN*\n`;
    text += `• Total Transaksi: ${stats.totalOrders}\n`;
    text += `• Total Pendapatan: ${formatPrice(stats.totalRevenue)}\n`;
    text += `• Rata-rata/Transaksi: ${formatPrice(stats.averageOrder)}\n\n`;
    
    text += `💰 *DETAIL PEMBAYARAN*\n`;
    text += `• Tunai: ${formatPrice(stats.cashRevenue)}\n`;
    text += `• Transfer: ${formatPrice(stats.transferRevenue)}\n`;
    text += `• QRIS: ${formatPrice(stats.qrisRevenue)}\n\n`;

    if (orders.length > 0) {
      text += `📋 *DAFTAR TRANSAKSI*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      
      orders.slice(0, 20).forEach((order, index) => {
        const time = format(new Date(order.created_at), 'HH:mm', { locale: idLocale });
        const paymentIcon = order.payment_method === 'cash' ? '💵' : order.payment_method === 'qris' ? '📱' : '💳';
        text += `${index + 1}. ${order.order_number}\n`;
        text += `   ${time} | ${paymentIcon} ${formatPrice(order.total)}\n`;
      });
      
      if (orders.length > 20) {
        text += `\n... dan ${orders.length - 20} transaksi lainnya\n`;
      }
    }
    
    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `_Laporan dibuat: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: idLocale })}_`;
    
    return text;
  };

  const shareToWhatsApp = () => {
    const reportText = generateReportText();
    const encodedText = encodeURIComponent(reportText);
    
    let whatsappUrl: string;
    if (whatsappNumber) {
      // Clean the phone number
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      const formattedNumber = cleanNumber.startsWith('0') 
        ? '62' + cleanNumber.slice(1) 
        : cleanNumber.startsWith('62') 
          ? cleanNumber 
          : '62' + cleanNumber;
      whatsappUrl = `https://wa.me/${formattedNumber}?text=${encodedText}`;
    } else {
      // Open WhatsApp without specific number
      whatsappUrl = `https://wa.me/?text=${encodedText}`;
    }
    
    window.open(whatsappUrl, '_blank');
    toast.success('Membuka WhatsApp...');
  };

  const copyToClipboard = () => {
    const reportText = generateReportText();
    navigator.clipboard.writeText(reportText);
    toast.success('Laporan disalin ke clipboard');
  };

  const periodOptions: { id: ReportPeriod; label: string }[] = [
    { id: 'today', label: 'Hari Ini' },
    { id: 'week', label: 'Minggu Ini' },
    { id: 'month', label: 'Bulan Ini' },
    { id: 'custom', label: 'Kustom' },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        {periodOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setPeriod(opt.id)}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-all text-sm",
              period === opt.id 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary hover:bg-secondary/80"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {period === 'custom' && (
        <div className="flex gap-3 items-center flex-wrap bg-card p-4 rounded-xl border border-border">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <Input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="w-auto"
          />
          <span className="text-muted-foreground">sampai</span>
          <Input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="w-auto"
          />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="w-4 h-4" />
            Total Transaksi
          </div>
          <div className="text-2xl font-bold mt-1">{stats.totalOrders}</div>
        </div>
        
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingUp className="w-4 h-4" />
            Total Pendapatan
          </div>
          <div className="text-2xl font-bold mt-1 text-primary">{formatPrice(stats.totalRevenue)}</div>
        </div>
        
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <TrendingUp className="w-4 h-4" />
            Rata-rata
          </div>
          <div className="text-2xl font-bold mt-1">{formatPrice(stats.averageOrder)}</div>
        </div>
        
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Banknote className="w-4 h-4" />
            Tunai
          </div>
          <div className="text-2xl font-bold mt-1 text-green-500">{formatPrice(stats.cashRevenue)}</div>
        </div>
        
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CreditCard className="w-4 h-4" />
            Transfer
          </div>
          <div className="text-2xl font-bold mt-1 text-blue-500">{formatPrice(stats.transferRevenue)}</div>
        </div>
        
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <QrCode className="w-4 h-4" />
            QRIS
          </div>
          <div className="text-2xl font-bold mt-1 text-purple-500">{formatPrice(stats.qrisRevenue)}</div>
        </div>
      </div>

      {/* WhatsApp Share */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-500" />
          Kirim Laporan via WhatsApp
        </h3>
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Nomor WhatsApp (opsional, contoh: 08123456789)"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className="flex-1 min-w-[250px]"
          />
          <Button onClick={shareToWhatsApp} className="bg-green-600 hover:bg-green-700">
            <MessageCircle className="w-4 h-4 mr-2" />
            Kirim ke WhatsApp
          </Button>
          <Button variant="outline" onClick={copyToClipboard}>
            <Download className="w-4 h-4 mr-2" />
            Salin Teks
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Kosongkan nomor untuk memilih kontak saat WhatsApp terbuka. Format nomor: 08xxx atau 628xxx
        </p>
      </div>

      {/* Daily Report Reminder */}
      <DailyReportReminder onSendReport={generateReportText} />

      {/* Transaction List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Daftar Transaksi - {getPeriodLabel()}</h3>
          <span className="text-sm text-muted-foreground">{orders.length} transaksi</span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Memuat data...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Tidak ada transaksi pada periode ini</div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {orders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{order.order_number}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">{formatPrice(order.total)}</div>
                    <div className={cn(
                      "text-xs px-2 py-0.5 rounded inline-block",
                      order.payment_method === 'cash' && "bg-green-500/20 text-green-500",
                      order.payment_method === 'transfer' && "bg-blue-500/20 text-blue-500",
                      order.payment_method === 'qris' && "bg-purple-500/20 text-purple-500"
                    )}>
                      {order.payment_method === 'cash' ? 'Tunai' : order.payment_method === 'transfer' ? 'Transfer' : 'QRIS'}
                    </div>
                  </div>
                </div>
                {order.order_items && order.order_items.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {order.order_items.map(item => `${item.quantity}x ${item.menu_item_name}`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
