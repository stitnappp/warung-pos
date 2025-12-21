import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Clock, MessageCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReminderSettings {
  enabled: boolean;
  time: string;
  phoneNumber: string;
}

interface DailyReportReminderProps {
  onSendReport: () => string; // Returns the report text
}

export function DailyReportReminder({ onSendReport }: DailyReportReminderProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: false,
    time: '21:00',
    phoneNumber: '',
  });
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dailyReportReminder');
    if (saved) {
      setSettings(JSON.parse(saved));
    }

    // Check notification permission
    if ('Notification' in window) {
      setHasNotificationPermission(Notification.permission === 'granted');
    }
  }, []);

  // Check time and show reminder
  useEffect(() => {
    if (!settings.enabled) return;

    const checkTime = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime === settings.time) {
        showReminder();
      }
    };

    // Check every minute
    const interval = setInterval(checkTime, 60000);
    
    // Also check immediately
    checkTime();

    return () => clearInterval(interval);
  }, [settings.enabled, settings.time]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setHasNotificationPermission(permission === 'granted');
      
      if (permission === 'granted') {
        toast({
          title: 'Notifikasi Diaktifkan',
          description: 'Anda akan menerima pengingat untuk mengirim laporan harian.',
        });
      } else {
        toast({
          title: 'Notifikasi Ditolak',
          description: 'Pengingat hanya akan muncul saat aplikasi terbuka.',
          variant: 'destructive',
        });
      }
    }
  };

  const showReminder = () => {
    // Show browser notification
    if (hasNotificationPermission && 'Notification' in window) {
      const notification = new Notification('RM MINANG MAIMBAOE - Laporan Harian', {
        body: 'Waktunya mengirim laporan transaksi harian via WhatsApp!',
        icon: '/icons/icon-512.png',
        tag: 'daily-report-reminder',
      });

      notification.onclick = () => {
        window.focus();
        sendReportToWhatsApp();
        notification.close();
      };
    }

    // Also show in-app toast
    toast({
      title: '⏰ Pengingat Laporan Harian',
      description: 'Waktunya mengirim laporan transaksi!',
      action: (
        <Button size="sm" onClick={sendReportToWhatsApp}>
          <MessageCircle className="w-4 h-4 mr-1" />
          Kirim
        </Button>
      ),
    });
  };

  const sendReportToWhatsApp = () => {
    const reportText = onSendReport();
    const phoneNumber = settings.phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(reportText)}`;
    window.open(whatsappUrl, '_blank');
  };

  const saveSettings = () => {
    localStorage.setItem('dailyReportReminder', JSON.stringify(settings));
    toast({
      title: 'Pengaturan Disimpan',
      description: `Pengingat ${settings.enabled ? 'aktif' : 'nonaktif'} pada jam ${settings.time}`,
    });
  };

  const testReminder = () => {
    showReminder();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Pengingat Laporan Harian
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Aktifkan Pengingat</Label>
            <p className="text-sm text-muted-foreground">
              Terima notifikasi untuk mengirim laporan
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => setSettings({ ...settings, enabled })}
          />
        </div>

        {settings.enabled && (
          <>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Jam Pengingat
              </Label>
              <Input
                type="time"
                value={settings.time}
                onChange={(e) => setSettings({ ...settings, time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Nomor WhatsApp Tujuan
              </Label>
              <Input
                type="tel"
                placeholder="6281234567890"
                value={settings.phoneNumber}
                onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Format: 62xxx (tanpa tanda +)
              </p>
            </div>

            {!hasNotificationPermission && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={requestNotificationPermission}
              >
                <Bell className="w-4 h-4 mr-2" />
                Izinkan Notifikasi Browser
              </Button>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveSettings}>
                <Save className="w-4 h-4 mr-2" />
                Simpan
              </Button>
              <Button variant="outline" onClick={testReminder}>
                Test
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
