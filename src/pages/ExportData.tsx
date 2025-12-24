import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Loader2, CheckCircle, Package } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const TABLES_TO_EXPORT = [
  { name: 'menu_categories', label: 'Kategori Menu' },
  { name: 'menu_items', label: 'Menu Items' },
  { name: 'restaurant_tables', label: 'Meja' },
  { name: 'restaurant_settings', label: 'Pengaturan Restoran' },
  { name: 'orders', label: 'Pesanan' },
  { name: 'order_items', label: 'Item Pesanan' },
  { name: 'daily_reports', label: 'Laporan Harian' },
  { name: 'accounting_entries', label: 'Entri Akuntansi' },
  { name: 'profiles', label: 'Profil Pengguna' },
  { name: 'user_roles', label: 'Role Pengguna' },
  { name: 'notification_settings', label: 'Pengaturan Notifikasi' },
  { name: 'payment_notifications', label: 'Notifikasi Pembayaran' },
];

export default function ExportData() {
  const { user, role, loading: authLoading } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Akses Ditolak</CardTitle>
            <CardDescription>Hanya admin yang dapat mengekspor data.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const addProgress = (message: string) => {
    setProgress(prev => [...prev, message]);
  };

  const exportAllData = async () => {
    setExporting(true);
    setProgress([]);

    try {
      const zip = new JSZip();
      const exportData: Record<string, any[]> = {};
      const exportDate = new Date().toISOString().split('T')[0];

      addProgress('Memulai ekspor data...');

      for (const table of TABLES_TO_EXPORT) {
        addProgress(`Mengekspor ${table.label}...`);
        
        const { data, error } = await supabase
          .from(table.name as any)
          .select('*');

        if (error) {
          console.error(`Error exporting ${table.name}:`, error);
          addProgress(`⚠️ Gagal mengekspor ${table.label}: ${error.message}`);
          continue;
        }

        exportData[table.name] = data || [];
        addProgress(`✓ ${table.label}: ${data?.length || 0} baris`);

        // Add individual JSON file for each table
        zip.file(`${table.name}.json`, JSON.stringify(data || [], null, 2));

        // Also create CSV for easier viewing
        if (data && data.length > 0) {
          const csv = convertToCSV(data);
          zip.file(`${table.name}.csv`, csv);
        }
      }

      // Add combined JSON file
      zip.file('all_data.json', JSON.stringify(exportData, null, 2));

      // Add README with instructions
      const readme = `# Warung POS Data Export
Tanggal Export: ${exportDate}

## File yang tersedia:
${TABLES_TO_EXPORT.map(t => `- ${t.name}.json / ${t.name}.csv - ${t.label}`).join('\n')}
- all_data.json - Semua data dalam satu file

## Cara Import:
1. Buat project baru di Lovable dari GitHub repo yang sama
2. Aktifkan Lovable Cloud
3. Jalankan migrasi database
4. Gunakan SQL Editor atau Supabase dashboard untuk import data

## Urutan Import (Penting!):
1. menu_categories
2. menu_items
3. restaurant_tables
4. restaurant_settings
5. profiles
6. user_roles
7. orders
8. order_items
9. daily_reports
10. accounting_entries
11. notification_settings
12. payment_notifications

## Catatan:
- Pastikan user sudah terdaftar sebelum import profiles dan user_roles
- Foreign key constraints harus diperhatikan saat import
`;
      zip.file('README.md', readme);

      addProgress('Membuat file ZIP...');

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `warung-pos-backup-${exportDate}.zip`);

      addProgress('✓ Export selesai! File ZIP telah diunduh.');
      toast.success('Data berhasil diekspor!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Gagal mengekspor data');
      addProgress(`❌ Error: ${error}`);
    } finally {
      setExporting(false);
    }
  };

  const convertToCSV = (data: any[]): string => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
        return String(value).replace(/"/g, '""');
      }).map(v => `"${v}"`).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-6 w-6" />
              Export Semua Data
            </CardTitle>
            <CardDescription>
              Ekspor semua data dari database ke file ZIP. File akan berisi JSON dan CSV untuk setiap tabel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Data yang akan diekspor:</h4>
              <ul className="grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                {TABLES_TO_EXPORT.map(table => (
                  <li key={table.name} className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {table.label}
                  </li>
                ))}
              </ul>
            </div>

            <Button 
              onClick={exportAllData} 
              disabled={exporting}
              className="w-full"
              size="lg"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengekspor...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download ZIP
                </>
              )}
            </Button>

            {progress.length > 0 && (
              <div className="bg-muted rounded-lg p-4 max-h-64 overflow-y-auto">
                <h4 className="font-medium mb-2">Progress:</h4>
                <div className="space-y-1 text-sm font-mono">
                  {progress.map((msg, idx) => (
                    <div key={idx} className="text-muted-foreground">
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Panduan Import</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Buat project baru di akun Lovable lain dari GitHub repo</p>
            <p>2. Aktifkan Lovable Cloud di project baru</p>
            <p>3. Jalankan semua migrasi database</p>
            <p>4. Import data JSON/CSV menggunakan tools seperti:</p>
            <ul className="list-disc list-inside ml-4">
              <li>Supabase Dashboard SQL Editor</li>
              <li>pgAdmin</li>
              <li>DBeaver</li>
            </ul>
            <p className="text-yellow-600">⚠️ Perhatikan urutan import karena ada foreign key constraints</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
