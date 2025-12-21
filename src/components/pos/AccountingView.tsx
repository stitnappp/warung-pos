import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, RefreshCw, TrendingUp, Wallet, CreditCard, Smartphone, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AccountingEntry {
  id: string;
  entry_date: string;
  entry_type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  payment_method: string | null;
  created_at: string;
}

export function AccountingView() {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(1)), // First day of current month
    to: new Date(),
  });
  const [isFromOpen, setIsFromOpen] = useState(false);
  const [isToOpen, setIsToOpen] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .gte('entry_date', dateRange.from.toISOString().split('T')[0])
        .lte('entry_date', dateRange.to.toISOString().split('T')[0])
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching accounting entries:', error);
      toast.error('Gagal memuat data accounting');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [dateRange]);

  const triggerDailySummary = async () => {
    try {
      toast.info('Membuat settlement harian...');
      const { data, error } = await supabase.functions.invoke('send-daily-summary');
      if (error) throw error;
      toast.success('Settlement berhasil dibuat');
      fetchEntries();
    } catch (error) {
      console.error('Error triggering daily summary:', error);
      toast.error('Gagal membuat settlement');
    }
  };

  // Calculate totals
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const summaryEntries = entries.filter(e => e.entry_type === 'daily_summary');
  const latestBalance = summaryEntries[0]?.balance || 0;

  // Group by payment method
  const cashTotal = entries.filter(e => e.payment_method === 'cash').reduce((sum, e) => sum + e.debit, 0);
  const transferTotal = entries.filter(e => e.payment_method === 'transfer').reduce((sum, e) => sum + e.debit, 0);
  const qrisTotal = entries.filter(e => e.payment_method === 'qris').reduce((sum, e) => sum + e.debit, 0);

  const getPaymentMethodIcon = (method: string | null) => {
    switch (method) {
      case 'cash': return <Wallet className="w-4 h-4" />;
      case 'transfer': return <CreditCard className="w-4 h-4" />;
      case 'qris': return <Smartphone className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getPaymentMethodColor = (method: string | null) => {
    switch (method) {
      case 'cash': return 'bg-success/20 text-success';
      case 'transfer': return 'bg-primary/20 text-primary';
      case 'qris': return 'bg-warning/20 text-warning';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Data Accounting
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={isFromOpen} onOpenChange={setIsFromOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(dateRange.from, 'dd MMM yyyy', { locale: id })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => {
                  if (date) {
                    setDateRange(prev => ({ ...prev, from: date }));
                    setIsFromOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">-</span>
          <Popover open={isToOpen} onOpenChange={setIsToOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(dateRange.to, 'dd MMM yyyy', { locale: id })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => {
                  if (date) {
                    setDateRange(prev => ({ ...prev, to: date }));
                    setIsToOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button onClick={triggerDailySummary} variant="secondary" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Settlement Hari Ini
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Debit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{formatPrice(totalDebit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Tunai
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(cashTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Transfer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(transferTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> QRIS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(qrisTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jurnal Accounting</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Belum ada data accounting</p>
              <p className="text-sm">Data akan otomatis terbuat setelah settlement harian</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.entry_date), 'dd MMM yyyy', { locale: id })}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">{entry.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("gap-1", getPaymentMethodColor(entry.payment_method))}>
                          {getPaymentMethodIcon(entry.payment_method)}
                          {entry.payment_method || entry.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-success font-medium">
                        {entry.debit > 0 ? formatPrice(entry.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-destructive font-medium">
                        {entry.credit > 0 ? formatPrice(entry.credit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {entry.entry_type === 'daily_summary' ? formatPrice(entry.balance) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
