import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

export interface BluetoothDevice {
  name: string;
  address: string;
}

interface PrinterStatus {
  isConnected: boolean;
  connectedDevice: BluetoothDevice | null;
  isScanning: boolean;
  isPrinting: boolean;
  devices: BluetoothDevice[];
  error: string | null;
}

// Check if running on native platform
const isNative = Capacitor.isNativePlatform();

const STORAGE_KEY = 'eppos_printer_device';

export function useBluetoothPrinter() {
  const [status, setStatus] = useState<PrinterStatus>({
    isConnected: false,
    connectedDevice: null,
    isScanning: false,
    isPrinting: false,
    devices: [],
    error: null,
  });

  const [thermalPrinter, setThermalPrinter] = useState<any>(null);
  const listenerRef = useRef<any>(null);
  const finishListenerRef = useRef<any>(null);

  // Load thermal printer plugin dynamically
  useEffect(() => {
    if (!isNative) return;

    import('capacitor-thermal-printer')
      .then((printerModule) => {
        const printer = printerModule.CapacitorThermalPrinter;
        setThermalPrinter(printer);
        console.log('Thermal printer plugin loaded');
      })
      .catch((err) => {
        console.error('Failed to load thermal printer plugin:', err);
      });
  }, []);

  // Scan for Bluetooth devices using thermal printer plugin's startScan
  const scanDevices = useCallback(async () => {
    if (!isNative || !thermalPrinter) {
      setStatus(prev => ({ 
        ...prev, 
        error: 'Fitur ini hanya tersedia di aplikasi Android' 
      }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, isScanning: true, error: null, devices: [] }));
      
      // Clean up previous listeners
      if (listenerRef.current) {
        await listenerRef.current.remove();
        listenerRef.current = null;
      }
      if (finishListenerRef.current) {
        await finishListenerRef.current.remove();
        finishListenerRef.current = null;
      }

      const foundDevices: BluetoothDevice[] = [];

      // Listen for discovered devices
      listenerRef.current = await thermalPrinter.addListener('discoverDevices', (data: { devices: BluetoothDevice[] }) => {
        console.log('Discovered devices:', data.devices);
        
        for (const device of data.devices) {
          // Check if device is not already in list
          if (!foundDevices.some(d => d.address === device.address)) {
            // Prioritize Eppos, RPP, and thermal printer devices
            const deviceName = device.name || 'Unknown Device';
            const isEppos = deviceName.toLowerCase().includes('eppos') || 
                           deviceName.toLowerCase().includes('rpp');
            const isPrinter = deviceName.toLowerCase().includes('printer') || 
                             deviceName.toLowerCase().includes('pos') ||
                             deviceName.toLowerCase().includes('thermal');
            
            if (isEppos || isPrinter) {
              foundDevices.unshift(device);
            } else {
              foundDevices.push(device);
            }
            
            setStatus(prev => ({ 
              ...prev, 
              devices: [...foundDevices]
            }));
          }
        }
      });

      // Listen for scan finish
      finishListenerRef.current = await thermalPrinter.addListener('discoveryFinish', () => {
        console.log('Discovery finished');
        setStatus(prev => ({ ...prev, isScanning: false }));
      });

      // Start scanning - this uses Bluetooth Classic on Android
      await thermalPrinter.startScan();
      console.log('Started scanning for printers...');

      // Auto stop after 15 seconds if not finished
      setTimeout(async () => {
        try {
          await thermalPrinter.stopScan();
        } catch (e) {
          console.log('Scan may have already stopped');
        }
        setStatus(prev => ({ ...prev, isScanning: false }));
      }, 15000);

    } catch (error: any) {
      console.error('Scan error:', error);
      setStatus(prev => ({ 
        ...prev, 
        isScanning: false, 
        error: error.message || 'Gagal mencari printer. Pastikan Bluetooth aktif dan izin diberikan.' 
      }));
    }
  }, [thermalPrinter]);

  // Connect to a specific printer
  const connectPrinter = useCallback(async (device: BluetoothDevice) => {
    if (!isNative || !thermalPrinter) {
      return false;
    }

    try {
      setStatus(prev => ({ ...prev, error: null }));
      
      // Connect using thermal printer plugin with device address
      await thermalPrinter.connect({ address: device.address });
      
      setStatus(prev => ({ 
        ...prev, 
        isConnected: true, 
        connectedDevice: device 
      }));
      
      // Save to localStorage for reconnection
      localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
      
      return true;
    } catch (error: any) {
      console.error('Connect error:', error);
      setStatus(prev => ({ 
        ...prev, 
        error: error.message || 'Gagal koneksi ke printer. Pastikan printer sudah di-pair.' 
      }));
      return false;
    }
  }, [thermalPrinter]);

  // Disconnect from printer
  const disconnectPrinter = useCallback(async () => {
    if (!isNative || !thermalPrinter) return;

    try {
      await thermalPrinter.disconnect();
      setStatus(prev => ({ 
        ...prev, 
        isConnected: false, 
        connectedDevice: null 
      }));
      localStorage.removeItem(STORAGE_KEY);
    } catch (error: any) {
      setStatus(prev => ({ 
        ...prev, 
        error: error.message || 'Gagal disconnect' 
      }));
    }
  }, [thermalPrinter]);

  // Test print function
  const testPrint = useCallback(async () => {
    if (!isNative || !thermalPrinter) {
      return false;
    }

    if (!status.isConnected) {
      setStatus(prev => ({ ...prev, error: 'Printer belum terhubung' }));
      return false;
    }

    try {
      setStatus(prev => ({ ...prev, isPrinting: true, error: null }));

      const dateStr = new Date().toLocaleDateString('id-ID');
      const timeStr = new Date().toLocaleTimeString('id-ID');

      // Use normal text size for better aesthetics
      await thermalPrinter.begin()
        .align('center')
        .bold()
        .text('TEST PRINT\n')
        .clearFormatting()
        .text('--------------------------------\n')
        .text('Printer Terhubung!\n')
        .text(`${dateStr} ${timeStr}\n`)
        .text('--------------------------------\n')
        .text('RM.MINANG MAIMBAOE\n')
        .text('\n\n')
        .cutPaper()
        .write();

      setStatus(prev => ({ ...prev, isPrinting: false }));
      return true;
    } catch (error: any) {
      setStatus(prev => ({ 
        ...prev, 
        isPrinting: false, 
        error: error.message || 'Test print gagal' 
      }));
      return false;
    }
  }, [status.isConnected, thermalPrinter]);

  // Print receipt
  const printReceipt = useCallback(async (receiptData: {
    orderNumber: string;
    cashierName: string;
    tableNumber?: number;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    amountPaid: number;
    change: number;
    timestamp: Date;
  }) => {
    if (!isNative || !thermalPrinter) {
      return false;
    }

    if (!status.isConnected) {
      setStatus(prev => ({ ...prev, error: 'Printer belum terhubung' }));
      return false;
    }

    try {
      setStatus(prev => ({ ...prev, isPrinting: true, error: null }));

      const paymentMethodText: Record<string, string> = {
        cash: 'Tunai',
        transfer: 'Transfer',
        qris: 'QRIS',
      };

      const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
          minimumFractionDigits: 0,
        }).format(price);
      };

      const dateStr = receiptData.timestamp.toLocaleDateString('id-ID');
      const timeStr = receiptData.timestamp.toLocaleTimeString('id-ID');

      // Build receipt using normal text size for better aesthetics
      let printer = thermalPrinter.begin();
      
      // Header - Restaurant name (normal size, bold)
      printer = printer
        .align('center')
        .bold()
        .text('RM.MINANG MAIMBAOE\n')
        .clearFormatting()
        .align('center')
        .text('Jln. Gatot Subroto no.10\n')
        .text('Depan Balai Desa Losari Kidul\n')
        .text('Losari, Cirebon 45192\n')
        .text('WA: 0812-XXXX-XXXX\n')
        .text('IG: @minangmaimbaoe\n')
        .text('--------------------------------\n');

      // Order info - compact format
      printer = printer
        .align('left')
        .text(`#${receiptData.orderNumber}\n`)
        .text(`Kasir: ${receiptData.cashierName}\n`);

      if (receiptData.tableNumber) {
        printer = printer.text(`Meja: ${receiptData.tableNumber}\n`);
      }

      printer = printer
        .text(`${dateStr} ${timeStr}\n`)
        .text('--------------------------------\n');

      // Items - single line format
      for (const item of receiptData.items) {
        const itemTotal = item.price * item.quantity;
        const itemName = item.name.length > 16 ? item.name.substring(0, 16) : item.name;
        printer = printer
          .align('left')
          .text(`${item.quantity}x ${itemName}\n`)
          .align('right')
          .text(`${formatPrice(itemTotal)}\n`);
      }

      printer = printer.align('left').text('--------------------------------\n');

      // Totals - compact format
      if (receiptData.discount > 0) {
        printer = printer.text(`Subtotal: Rp${formatPrice(receiptData.subtotal)}\n`);
        printer = printer.text(`Diskon: -Rp${formatPrice(receiptData.discount)}\n`);
      }
      
      printer = printer
        .bold()
        .text(`TOTAL: Rp${formatPrice(receiptData.total)}\n`)
        .clearFormatting()
        .text('--------------------------------\n')
        .text(`${paymentMethodText[receiptData.paymentMethod] || receiptData.paymentMethod}: Rp${formatPrice(receiptData.amountPaid)}\n`);
      
      if (receiptData.change > 0) {
        printer = printer.text(`Kembali: Rp${formatPrice(receiptData.change)}\n`);
      }
      
      printer = printer
        .text('--------------------------------\n')
        .align('center')
        .text('Terima Kasih!\n')
        .text('\n\n');

      // Print and cut paper
      await printer.cutPaper().write();

      setStatus(prev => ({ ...prev, isPrinting: false }));
      return true;
    } catch (error: any) {
      console.error('Print error:', error);
      setStatus(prev => ({ 
        ...prev, 
        isPrinting: false, 
        error: error.message || 'Gagal mencetak struk' 
      }));
      return false;
    }
  }, [status.isConnected, thermalPrinter]);

  // Try to reconnect to last printer on mount
  useEffect(() => {
    if (!isNative || !thermalPrinter) return;

    const lastPrinter = localStorage.getItem(STORAGE_KEY);
    if (lastPrinter) {
      try {
        const device = JSON.parse(lastPrinter) as BluetoothDevice;
        connectPrinter(device).catch(() => {
          // Failed to reconnect, clear storage
          localStorage.removeItem(STORAGE_KEY);
        });
      } catch (e) {
        console.error('Failed to parse last printer:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [connectPrinter, thermalPrinter]);

  return {
    ...status,
    isNative,
    scanDevices,
    connectPrinter,
    disconnectPrinter,
    printReceipt,
    testPrint,
  };
}
