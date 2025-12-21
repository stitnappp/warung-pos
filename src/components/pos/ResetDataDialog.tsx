import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, AlertTriangle } from 'lucide-react';

type ResetType = 'today' | 'all';

interface ResetDataDialogProps {
  onReset?: () => void;
}

export function ResetDataDialog({ onReset }: ResetDataDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resetType, setResetType] = useState<ResetType>('today');
  const [confirmText, setConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const CONFIRM_WORD = resetType === 'all' ? 'HAPUS SEMUA' : 'HAPUS HARI INI';

  const handleReset = async () => {
    if (confirmText !== CONFIRM_WORD) {
      toast.error(`Ketik "${CONFIRM_WORD}" untuk konfirmasi`);
      return;
    }

    setIsLoading(true);
    try {
      if (resetType === 'all') {
        // Delete all data
        const { error: itemsError } = await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (itemsError) throw itemsError;

        const { error: ordersError } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (ordersError) throw ordersError;

        const { error: reportsError } = await supabase.from('daily_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (reportsError) throw reportsError;

        toast.success('Semua data transaksi berhasil dihapus');
      } else {
        // Delete today's data only
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get today's order IDs first
        const { data: todayOrders } = await supabase
          .from('orders')
          .select('id')
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString());

        if (todayOrders && todayOrders.length > 0) {
          const orderIds = todayOrders.map(o => o.id);
          
          // Delete order items for today's orders
          const { error: itemsError } = await supabase
            .from('order_items')
            .delete()
            .in('order_id', orderIds);
          if (itemsError) throw itemsError;

          // Delete today's orders
          const { error: ordersError } = await supabase
            .from('orders')
            .delete()
            .in('id', orderIds);
          if (ordersError) throw ordersError;
        }

        // Delete today's daily report
        const { error: reportsError } = await supabase
          .from('daily_reports')
          .delete()
          .eq('report_date', today.toISOString().split('T')[0]);
        if (reportsError) throw reportsError;

        toast.success('Data transaksi hari ini berhasil dihapus');
      }

      setIsOpen(false);
      setConfirmText('');
      onReset?.();
    } catch (error) {
      console.error('Error resetting data:', error);
      toast.error('Gagal menghapus data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="w-4 h-4" />
          Reset Data Transaksi
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Reset Data Transaksi
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p className="font-medium text-foreground">
              Peringatan: Tindakan ini tidak dapat dibatalkan!
            </p>
            
            <div className="space-y-3">
              <p className="text-sm">Pilih data yang ingin dihapus:</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                  <input
                    type="radio"
                    name="resetType"
                    value="today"
                    checked={resetType === 'today'}
                    onChange={() => {
                      setResetType('today');
                      setConfirmText('');
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium">Transaksi Hari Ini</span>
                    <p className="text-xs text-muted-foreground">Hanya hapus transaksi hari ini</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-destructive/50 cursor-pointer hover:bg-destructive/10 transition-colors">
                  <input
                    type="radio"
                    name="resetType"
                    value="all"
                    checked={resetType === 'all'}
                    onChange={() => {
                      setResetType('all');
                      setConfirmText('');
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="font-medium text-destructive">Semua Transaksi</span>
                    <p className="text-xs text-muted-foreground">Hapus semua data dari awal</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-sm">
                Ketik <span className="font-mono font-bold text-destructive">{CONFIRM_WORD}</span> untuk konfirmasi:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                className="font-mono"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText('')}>Batal</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={confirmText !== CONFIRM_WORD || isLoading}
          >
            {isLoading ? 'Menghapus...' : 'Hapus Data'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
