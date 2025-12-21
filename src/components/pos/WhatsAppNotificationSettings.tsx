import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageCircle, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function WhatsAppNotificationSettings() {
  const { user } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [notifyOnTransaction, setNotifyOnTransaction] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingId, setSettingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchSettings();
    }
  }, [user?.id]);

  const fetchSettings = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWhatsappNumber(data.whatsapp_number || '');
        setNotifyOnTransaction(data.notify_on_transaction ?? true);
        setSettingId(data.id);
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      if (settingId) {
        // Update existing settings
        const { error } = await supabase
          .from('notification_settings')
          .update({
            whatsapp_number: whatsappNumber || null,
            notify_on_transaction: notifyOnTransaction,
            updated_at: new Date().toISOString()
          })
          .eq('id', settingId);

        if (error) throw error;
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from('notification_settings')
          .insert({
            user_id: user.id,
            whatsapp_number: whatsappNumber || null,
            notify_on_transaction: notifyOnTransaction
          })
          .select()
          .single();

        if (error) throw error;
        setSettingId(data.id);
      }

      toast.success('Pengaturan notifikasi berhasil disimpan');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-500" />
          Notifikasi WhatsApp
        </CardTitle>
        <CardDescription>
          Terima notifikasi otomatis via WhatsApp setiap ada transaksi dari kasir
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notify-toggle">Aktifkan Notifikasi</Label>
            <p className="text-sm text-muted-foreground">
              Terima pesan WhatsApp saat transaksi selesai
            </p>
          </div>
          <Switch
            id="notify-toggle"
            checked={notifyOnTransaction}
            onCheckedChange={setNotifyOnTransaction}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp-number">Nomor WhatsApp</Label>
          <Input
            id="whatsapp-number"
            type="tel"
            placeholder="08123456789"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            disabled={!notifyOnTransaction}
          />
          <p className="text-xs text-muted-foreground">
            Masukkan nomor WhatsApp untuk menerima notifikasi transaksi
          </p>
        </div>

        <Button 
          onClick={saveSettings} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Simpan Pengaturan
            </>
          )}
        </Button>

        {notifyOnTransaction && whatsappNumber && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✓ Notifikasi aktif. Anda akan menerima pesan WhatsApp setiap ada transaksi baru dari kasir.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
