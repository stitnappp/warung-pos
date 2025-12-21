import { MenuItem } from '@/types/pos';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface MenuGridProps {
  items: MenuItem[];
  onAddItem: (item: MenuItem) => void;
}

export function MenuGrid({ items, onAddItem }: MenuGridProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => onAddItem(item)}
          className={cn(
            "group relative flex flex-col p-4 bg-card rounded-xl border border-border/50",
            "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
            "active:scale-95 transition-all duration-200",
            "animate-fade-in touch-action-pan-y"
          )}
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="w-4 h-4 text-primary" />
          </div>
          
          <div className="flex-1 flex flex-col justify-between min-h-[80px]">
            <h3 className="font-semibold text-foreground text-left text-sm leading-tight mb-2">
              {item.name}
            </h3>
            <p className="text-primary font-bold text-lg">
              {formatPrice(item.price)}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
