import { MenuCategory } from '@/types/pos';
import { UtensilsCrossed, Coffee, Cookie } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryTabsProps {
  activeCategory: MenuCategory;
  onCategoryChange: (category: MenuCategory) => void;
}

const categories: { id: MenuCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'makanan', label: 'Makanan', icon: <UtensilsCrossed className="w-5 h-5" /> },
  { id: 'minuman', label: 'Minuman', icon: <Coffee className="w-5 h-5" /> },
  { id: 'snack', label: 'Snack', icon: <Cookie className="w-5 h-5" /> },
];

export function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 p-2 bg-card rounded-xl">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-4 px-4 rounded-lg font-semibold text-sm transition-all duration-200",
            "active:scale-95 touch-action-pan-y",
            activeCategory === category.id
              ? "bg-primary text-primary-foreground shadow-lg"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {category.icon}
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  );
}
