import { useState, useMemo } from 'react';
import { useMenuItems, MenuItem } from '@/hooks/useMenuItems';
import { useTables } from '@/hooks/useTables';
import { useOrders, CartItem } from '@/hooks/useOrders';
import { Header } from '@/components/pos/Header';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { OrderHistory } from '@/components/pos/OrderHistory';
import { printReceipt } from '@/utils/receiptPrinter';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const Index = () => {
  const { categories, items, loading: menuLoading } = useMenuItems();
  const { tables } = useTables();
  const { todayOrders, createOrder } = useOrders();
  const { fullName } = useAuth();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Set default category when loaded
  useMemo(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  const filteredItems = useMemo(
    () => items.filter((item) => item.category_id === activeCategory),
    [items, activeCategory]
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
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
    toast.success(`${item.name} ditambahkan`, { duration: 1500, position: 'bottom-center' });
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
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

  const handleCompleteOrder = async (paymentMethod: 'cash' | 'transfer' | 'qris', amountPaid: number) => {
    try {
      const order = await createOrder(cart, selectedTable, paymentMethod, amountPaid);

      const tableNum = selectedTable ? tables.find(t => t.id === selectedTable)?.table_number : undefined;

      printReceipt({
        orderNumber: order.order_number,
        cashierName: fullName || 'Kasir',
        tableNumber: tableNum,
        items: cart,
        subtotal: cartTotal,
        discount: 0,
        total: cartTotal,
        paymentMethod,
        amountPaid,
        change: paymentMethod === 'cash' ? amountPaid - cartTotal : 0,
        timestamp: new Date(),
      });

      setCart([]);
      setSelectedTable(null);
      setIsCheckoutOpen(false);
      toast.success('Transaksi berhasil!', { position: 'bottom-center' });
    } catch (error) {
      toast.error('Gagal menyimpan transaksi');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onOpenHistory={() => setIsHistoryOpen(true)} orderCount={todayOrders.length} />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <CategoryTabs
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
          <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
            <MenuGrid items={filteredItems} onAddItem={handleAddItem} loading={menuLoading} />
          </div>
        </div>

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
        tables={tables}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
        onComplete={handleCompleteOrder}
      />

      <OrderHistory isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} orders={todayOrders} />
    </div>
  );
};

export default Index;
