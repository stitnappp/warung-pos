import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { Bluetooth, BluetoothSearching, Printer, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BluetoothPrinterSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BluetoothPrinterSettings({ isOpen, onClose }: BluetoothPrinterSettingsProps) {
  const {
    isNative,
    isConnected,
    connectedDevice,
    isScanning,
    devices,
    error,
    scanDevices,
    connectPrinter,
    disconnectPrinter,
  } = useBluetoothPrinter();

  const handleScan = async () => {
    await scanDevices();
  };

  const handleConnect = async (device: { name: string; address: string }) => {
    const success = await connectPrinter(device);
    if (success) {
      toast.success(`Terhubung ke ${device.name}`);
    } else {
      toast.error('Gagal menghubungkan printer');
    }
  };

  const handleDisconnect = async () => {
    await disconnectPrinter();
    toast.info('Printer terputus');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Bluetooth Printer</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!isNative ? (
            <div className="text-center py-8">
              <Bluetooth className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Fitur Bluetooth Printer hanya tersedia di aplikasi Android.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Saat ini menggunakan Web Print untuk mencetak struk.
              </p>
            </div>
          ) : (
            <>
              {/* Connection Status */}
              <div className={cn(
                "p-4 rounded-xl flex items-center gap-3",
                isConnected ? "bg-success/10 border border-success/20" : "bg-muted"
              )}>
                {isConnected ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-success" />
                    <div className="flex-1">
                      <p className="font-medium text-success">Terhubung</p>
                      <p className="text-sm text-muted-foreground">{connectedDevice?.name}</p>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
                    >
                      Putus
                    </button>
                  </>
                ) : (
                  <>
                    <BluetoothSearching className="w-6 h-6 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Tidak Terhubung</p>
                      <p className="text-sm text-muted-foreground">Cari printer untuk menghubungkan</p>
                    </div>
                  </>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Scan Button */}
              <button
                onClick={handleScan}
                disabled={isScanning}
                className={cn(
                  "w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                  isScanning 
                    ? "bg-muted text-muted-foreground" 
                    : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                )}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Mencari Printer...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Cari Printer
                  </>
                )}
              </button>

              {/* Device List */}
              {devices.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Printer Ditemukan ({devices.length})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {devices.map((device) => (
                      <button
                        key={device.address}
                        onClick={() => handleConnect(device)}
                        disabled={isConnected && connectedDevice?.address === device.address}
                        className={cn(
                          "w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all",
                          connectedDevice?.address === device.address
                            ? "bg-success/10 border border-success/20"
                            : "bg-secondary hover:bg-secondary/80 active:scale-95"
                        )}
                      >
                        <Printer className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{device.name || 'Unknown Device'}</p>
                          <p className="text-xs text-muted-foreground truncate">{device.address}</p>
                        </div>
                        {connectedDevice?.address === device.address && (
                          <CheckCircle className="w-5 h-5 text-success" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p><strong>Cara Menggunakan:</strong></p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Nyalakan Bluetooth printer Anda</li>
                  <li>Pastikan printer sudah di-pair dengan HP</li>
                  <li>Tekan "Cari Printer" untuk mencari</li>
                  <li>Pilih printer dari daftar untuk menghubungkan</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
