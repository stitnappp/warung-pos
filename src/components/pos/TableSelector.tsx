import { RestaurantTable } from '@/hooks/useTables';
import { cn } from '@/lib/utils';
import { Users, X } from 'lucide-react';

interface TableSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  tables: RestaurantTable[];
  selectedTable: string | null;
  onSelectTable: (tableId: string | null) => void;
}

export function TableSelector({
  isOpen,
  onClose,
  tables,
  selectedTable,
  onSelectTable,
}: TableSelectorProps) {
  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-success/20 border-success/30 text-success';
      case 'occupied':
        return 'bg-destructive/20 border-destructive/30 text-destructive';
      case 'reserved':
        return 'bg-accent/20 border-accent/30 text-accent';
      default:
        return 'bg-muted border-border';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Tersedia';
      case 'occupied':
        return 'Terisi';
      case 'reserved':
        return 'Dipesan';
      default:
        return status;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Pilih Meja</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Take Away Option */}
          <button
            onClick={() => {
              onSelectTable(null);
              onClose();
            }}
            className={cn(
              "w-full mb-4 p-4 rounded-xl border-2 transition-all",
              selectedTable === null
                ? "bg-primary/10 border-primary text-primary"
                : "bg-secondary border-transparent hover:border-primary/50"
            )}
          >
            <span className="font-semibold">🥡 Bawa Pulang (Take Away)</span>
          </button>

          {/* Tables Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => {
                  if (table.status === 'available') {
                    onSelectTable(table.id);
                    onClose();
                  }
                }}
                disabled={table.status !== 'available'}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                  table.status === 'available'
                    ? selectedTable === table.id
                      ? "bg-primary/10 border-primary"
                      : "bg-secondary border-transparent hover:border-primary/50"
                    : "opacity-50 cursor-not-allowed border-transparent",
                  getStatusColor(table.status)
                )}
              >
                <span className="text-2xl font-bold">#{table.table_number}</span>
                <div className="flex items-center gap-1 mt-2 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{table.capacity} orang</span>
                </div>
                <span className="text-xs mt-1 opacity-75">{getStatusText(table.status)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
