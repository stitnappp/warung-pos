import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Upload, Loader2 } from 'lucide-react';

interface BackupData {
  version: string;
  exportedAt: string;
  menu_categories: any[];
  menu_items: any[];
  restaurant_tables: any[];
  restaurant_settings: any[];
  notification_settings: any[];
}

export function DataBackupRestore() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch all data
      const [categories, items, tables, settings, notifications] = await Promise.all([
        supabase.from('menu_categories').select('*'),
        supabase.from('menu_items').select('*'),
        supabase.from('restaurant_tables').select('*'),
        supabase.from('restaurant_settings').select('*'),
        supabase.from('notification_settings').select('*'),
      ]);

      if (categories.error) throw categories.error;
      if (items.error) throw items.error;
      if (tables.error) throw tables.error;
      if (settings.error) throw settings.error;

      const backupData: BackupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        menu_categories: categories.data || [],
        menu_items: items.data || [],
        restaurant_tables: tables.data || [],
        restaurant_settings: settings.data || [],
        notification_settings: notifications.data || [],
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warung-pos-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data berhasil di-export!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Gagal export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const backupData: BackupData = JSON.parse(text);

      // Validate backup file
      if (!backupData.version || !backupData.menu_categories) {
        throw new Error('File backup tidak valid');
      }

      // Import categories first (remove id to let database generate new ones)
      if (backupData.menu_categories.length > 0) {
        const categoriesWithoutId = backupData.menu_categories.map(({ id, created_at, ...rest }) => rest);
        const { error: catError } = await supabase
          .from('menu_categories')
          .upsert(categoriesWithoutId, { onConflict: 'name' });
        if (catError) console.error('Categories import error:', catError);
      }

      // Get the newly inserted categories to map old IDs to new ones
      const { data: newCategories } = await supabase.from('menu_categories').select('*');
      const categoryMap = new Map<string, string>();
      backupData.menu_categories.forEach((oldCat) => {
        const newCat = newCategories?.find(c => c.name === oldCat.name);
        if (newCat) categoryMap.set(oldCat.id, newCat.id);
      });

      // Import menu items with updated category_id
      if (backupData.menu_items.length > 0) {
        const itemsWithNewCategoryId = backupData.menu_items.map(({ id, created_at, updated_at, ...rest }) => ({
          ...rest,
          category_id: rest.category_id ? categoryMap.get(rest.category_id) || rest.category_id : null,
        }));
        
        for (const item of itemsWithNewCategoryId) {
          const { error: itemError } = await supabase
            .from('menu_items')
            .upsert(item, { onConflict: 'name' });
          if (itemError) console.error('Menu item import error:', itemError);
        }
      }

      // Import tables
      if (backupData.restaurant_tables.length > 0) {
        const tablesWithoutId = backupData.restaurant_tables.map(({ id, created_at, current_order_id, ...rest }) => ({
          ...rest,
          status: 'available',
        }));
        
        for (const table of tablesWithoutId) {
          const { error: tableError } = await supabase
            .from('restaurant_tables')
            .upsert(table, { onConflict: 'table_number' });
          if (tableError) console.error('Table import error:', tableError);
        }
      }

      // Import restaurant settings
      if (backupData.restaurant_settings.length > 0) {
        const settingsWithoutId = backupData.restaurant_settings.map(({ id, created_at, updated_at, ...rest }) => rest);
        const { error: settingsError } = await supabase
          .from('restaurant_settings')
          .upsert(settingsWithoutId[0]);
        if (settingsError) console.error('Settings import error:', settingsError);
      }

      toast.success('Data berhasil di-import! Refresh halaman untuk melihat perubahan.');
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Gagal import data. Pastikan file backup valid.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-card p-6 rounded-xl border border-border">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <Download className="w-5 h-5 text-primary" />
        Backup & Restore Data
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Export data untuk backup atau pindah ke project baru. Import untuk restore data dari backup.
      </p>
      
      <div className="flex flex-wrap gap-3">
        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="flex items-center gap-2"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export Data
        </Button>
        
        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={isImporting}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <Button 
            variant="outline" 
            disabled={isImporting}
            className="flex items-center gap-2 pointer-events-none"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Import Data
          </Button>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Data yang di-export:</strong> Kategori menu, Menu items, Meja, Pengaturan restoran
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          <strong>Catatan:</strong> Data transaksi (orders) tidak termasuk dalam backup untuk menghindari duplikasi.
        </p>
      </div>
    </div>
  );
}
