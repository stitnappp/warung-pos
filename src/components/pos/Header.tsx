import { useState, useEffect } from 'react';
import { Receipt, Clock, LogOut, Settings, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenPrinterSettings: () => void;
  orderCount: number;
}

export function Header({ onOpenHistory, onOpenPrinterSettings, orderCount }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { fullName, role, signOut } = useAuth();
  const navigate = useNavigate();

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="flex items-center justify-between p-4 bg-card border-b border-border/50">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-2xl">🍽️</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">RM MINANG MAIMBAOE</h1>
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
          onClick={onOpenPrinterSettings}
          className="flex items-center gap-2 px-3 py-3 bg-secondary hover:bg-secondary/80 rounded-xl transition-all active:scale-95"
          title="Pengaturan Printer"
        >
          <Printer className="w-5 h-5" />
        </button>

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-xl transition-all">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {fullName ? getInitials(fullName) : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium">{fullName || 'User'}</p>
                <p className="text-xs text-muted-foreground capitalize">{role || 'kasir'}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {role === 'admin' && (
              <>
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Admin Panel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
