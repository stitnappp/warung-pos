import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuItems } from '@/hooks/useMenuItems';
import { useTables } from '@/hooks/useTables';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, BarChart3, UtensilsCrossed, Users, Settings, Wrench, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/utils/receiptPrinter';
import { TransactionReport } from '@/components/pos/TransactionReport';
import { ResetDataDialog } from '@/components/pos/ResetDataDialog';
import { PaymentNotifications } from '@/components/pos/PaymentNotifications';
import { TelegramNotificationSettings } from '@/components/pos/TelegramNotificationSettings';
import { AccountingView } from '@/components/pos/AccountingView';
import { RestaurantSettingsPanel } from '@/components/pos/RestaurantSettingsPanel';

type AdminTab = 'menu' | 'tables' | 'reports' | 'accounting' | 'settings';

export default function Admin() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');

  if (role !== 'admin') {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Panel</h1>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-4 bg-card border-b border-border overflow-x-auto">
        {[
          { id: 'menu' as AdminTab, label: 'Kelola Menu', icon: <UtensilsCrossed className="w-4 h-4" /> },
          { id: 'tables' as AdminTab, label: 'Kelola Meja', icon: <Users className="w-4 h-4" /> },
          { id: 'reports' as AdminTab, label: 'Laporan', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'accounting' as AdminTab, label: 'Accounting', icon: <Calculator className="w-4 h-4" /> },
          { id: 'settings' as AdminTab, label: 'Pengaturan', icon: <Wrench className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
              activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'menu' && <MenuManager />}
        {activeTab === 'tables' && <TableManager />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'accounting' && <AccountingView />}
        {activeTab === 'settings' && <SettingsView />}
      </div>
    </div>
  );
}

function MenuManager() {
  const { categories, items, addItem, updateItem, deleteItem, refetch } = useMenuItems();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: '', price: '', category_id: '' });

  const handleAdd = async () => {
    if (!newItem.name || !newItem.price || !newItem.category_id) {
      toast.error('Lengkapi semua field');
      return;
    }
    try {
      await addItem({ name: newItem.name, price: parseInt(newItem.price), category_id: newItem.category_id, image_url: null, is_available: true });
      setNewItem({ name: '', price: '', category_id: '' });
      toast.success('Menu berhasil ditambahkan');
    } catch { toast.error('Gagal menambahkan menu'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem(id);
      toast.success('Menu berhasil dihapus');
    } catch { toast.error('Gagal menghapus menu'); }
  };

  return (
    <div className="space-y-6">
      {/* Add New Item */}
      <div className="bg-card p-4 rounded-xl border border-border">
        <h3 className="font-semibold mb-4">Tambah Menu Baru</h3>
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Nama menu" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="flex-1 min-w-[200px]" />
          <Input placeholder="Harga" type="number" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} className="w-32" />
          <select value={newItem.category_id} onChange={(e) => setNewItem({ ...newItem, category_id: e.target.value })} className="px-3 py-2 rounded-lg bg-secondary border border-border">
            <option value="">Pilih Kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />Tambah</Button>
        </div>
      </div>

      {/* Menu List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 bg-secondary font-semibold text-sm">
          <div className="col-span-5">Nama</div>
          <div className="col-span-3">Kategori</div>
          <div className="col-span-2">Harga</div>
          <div className="col-span-2">Aksi</div>
        </div>
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-4 p-4 border-t border-border items-center">
            <div className="col-span-5 font-medium">{item.name}</div>
            <div className="col-span-3 text-muted-foreground">{categories.find(c => c.id === item.category_id)?.name}</div>
            <div className="col-span-2 text-primary font-semibold">{formatPrice(item.price)}</div>
            <div className="col-span-2 flex gap-2">
              <button onClick={() => handleDelete(item.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableManager() {
  const { tables, addTable, deleteTable } = useTables();
  const [newTable, setNewTable] = useState({ number: '', capacity: '4' });

  const handleAdd = async () => {
    if (!newTable.number) { toast.error('Masukkan nomor meja'); return; }
    try {
      await addTable(parseInt(newTable.number), parseInt(newTable.capacity));
      setNewTable({ number: '', capacity: '4' });
      toast.success('Meja berhasil ditambahkan');
    } catch { toast.error('Gagal menambahkan meja'); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card p-4 rounded-xl border border-border">
        <h3 className="font-semibold mb-4">Tambah Meja Baru</h3>
        <div className="flex gap-3">
          <Input placeholder="Nomor meja" type="number" value={newTable.number} onChange={(e) => setNewTable({ ...newTable, number: e.target.value })} className="w-32" />
          <Input placeholder="Kapasitas" type="number" value={newTable.capacity} onChange={(e) => setNewTable({ ...newTable, capacity: e.target.value })} className="w-32" />
          <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-2" />Tambah</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map((table) => (
          <div key={table.id} className="bg-card p-4 rounded-xl border border-border text-center">
            <div className="text-2xl font-bold">#{table.table_number}</div>
            <div className="text-sm text-muted-foreground">{table.capacity} orang</div>
            <div className={cn("text-xs mt-2 px-2 py-1 rounded", table.status === 'available' ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>{table.status === 'available' ? 'Tersedia' : 'Terisi'}</div>
            <button onClick={() => deleteTable(table.id)} className="mt-3 text-destructive text-sm hover:underline">Hapus</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsView() {
  return <TransactionReport />;
}

function SettingsView() {
  return (
    <div className="space-y-6">
      {/* Restaurant Settings for Receipt */}
      <RestaurantSettingsPanel />

      {/* Telegram Notification Settings */}
      <TelegramNotificationSettings />

      {/* Payment Notifications */}
      <PaymentNotifications />

      {/* Reset Data Section */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-destructive" />
          Reset Data Transaksi
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Hapus data transaksi dari database. Tindakan ini tidak dapat dibatalkan.
        </p>
        <ResetDataDialog />
      </div>

      {/* Midtrans Webhook Info */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <h3 className="font-semibold mb-2">Konfigurasi Midtrans</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Untuk menerima notifikasi pembayaran otomatis, tambahkan URL webhook berikut di dashboard Midtrans:
        </p>
        <code className="block bg-secondary p-3 rounded-lg text-sm break-all">
          https://mgqvvvlkgpioikeebgln.supabase.co/functions/v1/midtrans-webhook
        </code>
      </div>

      {/* Info Section */}
      <div className="bg-secondary/50 p-6 rounded-xl border border-border">
        <h3 className="font-semibold mb-2">Informasi Aplikasi</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• Data tersimpan di cloud dan aman</p>
          <p>• Backup otomatis setiap hari</p>
          <p>• Gunakan fitur laporan untuk export data sebelum reset</p>
        </div>
      </div>
    </div>
  );
}
