import { MenuCategory } from '@/hooks/useMenuItems';
import { UtensilsCrossed, Coffee, Cookie } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryTabsProps {
  categories: MenuCategory[];
  activeCategory: string | null;
  onCategoryChange: (categoryId: string) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  utensils: <UtensilsCrossed className="w-5 h-5" />,
  coffee: <Coffee className="w-5 h-5" />,
  cookie: <Cookie className="w-5 h-5" />,
};

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 p-2 bg-card rounded-xl overflow-x-auto no-scrollbar">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={cn(
            "flex-shrink-0 flex items-center justify-center gap-2 py-4 px-6 rounded-lg font-semibold text-sm transition-all duration-200",
            "active:scale-95 touch-action-pan-y",
            activeCategory === category.id
              ? "bg-primary text-primary-foreground shadow-lg"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {iconMap[category.icon || ''] || <UtensilsCrossed className="w-5 h-5" />}
          <span>{category.name}</span>
        </button>
      ))}
    </div>
  );
}
