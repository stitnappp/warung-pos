import { useState, useEffect } from 'react';
import { useRestaurantSettings } from '@/hooks/useRestaurantSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, Save, Loader2 } from 'lucide-react';

export function RestaurantSettingsPanel() {
  const { settings, isLoading, updateSettings, isUpdating } = useRestaurantSettings();

  const [form, setForm] = useState({
    restaurant_name: '',
    address_line1: '',
    address_line2: '',
    address_line3: '',
    whatsapp_number: '',
    instagram_handle: '',
    footer_message: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        restaurant_name: settings.restaurant_name || '',
        address_line1: settings.address_line1 || '',
        address_line2: settings.address_line2 || '',
        address_line3: settings.address_line3 || '',
        whatsapp_number: settings.whatsapp_number || '',
        instagram_handle: settings.instagram_handle || '',
        footer_message: settings.footer_message || '',
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings(form);
  };

  if (isLoading) {
    return (
      <div className="bg-card p-6 rounded-xl border border-border flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-xl border border-border">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Store className="w-5 h-5 text-primary" />
        Informasi Restoran (untuk Struk)
      </h3>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="restaurant_name">Nama Restoran</Label>
          <Input
            id="restaurant_name"
            value={form.restaurant_name}
            onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })}
            placeholder="Nama restoran"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address_line1">Alamat Baris 1</Label>
            <Input
              id="address_line1"
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
              placeholder="Jln. Contoh No.1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line2">Alamat Baris 2</Label>
            <Input
              id="address_line2"
              value={form.address_line2}
              onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
              placeholder="Kecamatan, Kelurahan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line3">Alamat Baris 3</Label>
            <Input
              id="address_line3"
              value={form.address_line3}
              onChange={(e) => setForm({ ...form, address_line3: e.target.value })}
              placeholder="Kota, Kode Pos"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">Nomor WhatsApp</Label>
            <Input
              id="whatsapp_number"
              value={form.whatsapp_number}
              onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              placeholder="0812-XXXX-XXXX"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram_handle">Akun Instagram</Label>
            <Input
              id="instagram_handle"
              value={form.instagram_handle}
              onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })}
              placeholder="@username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="footer_message">Pesan di Bagian Bawah Struk</Label>
          <Input
            id="footer_message"
            value={form.footer_message}
            onChange={(e) => setForm({ ...form, footer_message: e.target.value })}
            placeholder="Terima Kasih!"
          />
        </div>

        <Button onClick={handleSave} disabled={isUpdating} className="w-full md:w-auto">
          {isUpdating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Simpan Pengaturan
        </Button>
      </div>
    </div>
  );
}
