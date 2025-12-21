import { useState, useMemo } from 'react';
import { MenuCategory, CartItem, MenuItem, Order } from '@/types/pos';
import { menuItems } from '@/data/menuItems';
import { Header } from '@/components/pos/Header';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { OrderHistory } from '@/components/pos/OrderHistory';
import { toast } from 'sonner';

const Index = () => {
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('makanan');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const filteredItems = useMemo(
    () => menuItems.filter((item) => item.category === activeCategory),
    [activeCategory]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const handleAddItem = (item: MenuItem) => {
    setCart((prev) => {
      const existingItem = prev.find((i) => i.id === item.id);
      if (existingItem) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} ditambahkan`, {
      duration: 1500,
      position: 'bottom-center',
    });
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(id);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
    toast.info('Pesanan dihapus', { position: 'bottom-center' });
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsCheckoutOpen(true);
  };

  const handleCompleteOrder = (paymentMethod: 'cash' | 'transfer', amountPaid: number) => {
    const newOrder: Order = {
      id: String(Date.now()).slice(-6),
      items: [...cart],
      total: cartTotal,
      timestamp: new Date(),
      paymentMethod,
      amountPaid,
      change: amountPaid - cartTotal,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);
    setIsCheckoutOpen(false);
    
    toast.success('Transaksi berhasil!', {
      description: `Order #${newOrder.id} telah disimpan`,
      position: 'bottom-center',
      duration: 3000,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onOpenHistory={() => setIsHistoryOpen(true)} orderCount={orders.length} />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        {/* Menu Section */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
          <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
            <MenuGrid items={filteredItems} onAddItem={handleAddItem} />
          </div>
        </div>

        {/* Cart Section */}
        <div className="lg:w-96 h-[45vh] lg:h-auto">
          <CartPanel
            items={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckout}
            onClear={handleClearCart}
          />
        </div>
      </div>

      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        total={cartTotal}
        onComplete={handleCompleteOrder}
      />

      <OrderHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        orders={orders}
      />
    </div>
  );
};

export default Index;
