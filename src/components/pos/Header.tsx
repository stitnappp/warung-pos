import { useState, useEffect } from 'react';
import { Receipt, Clock } from 'lucide-react';

interface HeaderProps {
  onOpenHistory: () => void;
  orderCount: number;
}

export function Header({ onOpenHistory, orderCount }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  return (
    <header className="flex items-center justify-between p-4 bg-card border-b border-border/50">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-2xl">🍽️</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Warung Makan</h1>
          <p className="text-sm text-muted-foreground">Sistem Kasir Digital</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex flex-col items-end">
          <div className="flex items-center gap-2 text-foreground">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold">{formatTime(currentTime)}</span>
          </div>
          <span className="text-xs text-muted-foreground">{formatDate(currentTime)}</span>
        </div>

        <button
          onClick={onOpenHistory}
          className="flex items-center gap-2 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-xl transition-all active:scale-95"
        >
          <Receipt className="w-5 h-5" />
          <span className="font-medium hidden sm:inline">Riwayat</span>
          {orderCount > 0 && (
            <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full">
              {orderCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
