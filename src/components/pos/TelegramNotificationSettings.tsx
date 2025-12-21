import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, MessageCircle } from "lucide-react";

export function TelegramNotificationSettings() {
  const [telegramChatId, setTelegramChatId] = useState("");
  const [notifyOnTransaction, setNotifyOnTransaction] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notification_settings")
      .select("telegram_chat_id, notify_on_transaction")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setTelegramChatId(data.telegram_chat_id || "");
      setNotifyOnTransaction(data.notify_on_transaction ?? true);
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: existing } = await supabase
        .from("notification_settings")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("notification_settings")
          .update({
            telegram_chat_id: telegramChatId || null,
            notify_on_transaction: notifyOnTransaction,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("notification_settings").insert({
          user_id: user.id,
          telegram_chat_id: telegramChatId || null,
          notify_on_transaction: notifyOnTransaction,
        });

        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: "Pengaturan notifikasi Telegram berhasil disimpan",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Gagal menyimpan pengaturan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testNotification = async () => {
    if (!telegramChatId) {
      toast({
        title: "Error",
        description: "Masukkan Chat ID Telegram terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-whatsapp-notification",
        {
          body: {
            orderNumber: "TEST-001",
            total: 50000,
            cashierName: "Test Kasir",
            paymentMethod: "cash",
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Test Notifikasi",
        description: "Notifikasi test telah dikirim ke Telegram",
      });
    } catch (error) {
      console.error("Error testing notification:", error);
      toast({
        title: "Error",
        description: "Gagal mengirim notifikasi test",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Notifikasi Telegram
        </CardTitle>
        <CardDescription>
          Terima notifikasi transaksi melalui bot Telegram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="telegram-chat-id">Chat ID Telegram</Label>
          <Input
            id="telegram-chat-id"
            placeholder="Contoh: 123456789"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Untuk mendapatkan Chat ID, kirim pesan ke bot{" "}
            <a
              href="https://t.me/userinfobot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              @userinfobot
            </a>{" "}
            di Telegram. Kemudian pastikan Anda sudah memulai chat dengan bot POS Anda.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Notifikasi Transaksi</Label>
            <p className="text-sm text-muted-foreground">
              Terima notifikasi setiap ada transaksi baru
            </p>
          </div>
          <Switch
            checked={notifyOnTransaction}
            onCheckedChange={setNotifyOnTransaction}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={saveSettings} disabled={isLoading}>
            {isLoading ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
          <Button
            variant="outline"
            onClick={testNotification}
            disabled={isTesting || !telegramChatId}
          >
            <Send className="h-4 w-4 mr-2" />
            {isTesting ? "Mengirim..." : "Test Notifikasi"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
