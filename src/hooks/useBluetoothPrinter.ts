import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

interface BluetoothDevice {
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

// Dynamic import for native-only plugin
let CapacitorThermalPrinter: any = null;

if (isNative) {
  import('capacitor-thermal-printer').then((module) => {
    CapacitorThermalPrinter = module.CapacitorThermalPrinter;
  }).catch(console.error);
}

export function useBluetoothPrinter() {
  const [status, setStatus] = useState<PrinterStatus>({
    isConnected: false,
    connectedDevice: null,
    isScanning: false,
    isPrinting: false,
    devices: [],
    error: null,
  });

  // Scan for Bluetooth devices
  const scanDevices = useCallback(async () => {
    if (!isNative || !CapacitorThermalPrinter) {
      setStatus(prev => ({ 
        ...prev, 
        error: 'Fitur ini hanya tersedia di aplikasi Android' 
      }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, isScanning: true, error: null }));
      
      const result = await CapacitorThermalPrinter.listPrinters();
      const devices: BluetoothDevice[] = result.printers || [];
      
      setStatus(prev => ({ 
        ...prev, 
        devices, 
        isScanning: false 
      }));
    } catch (error: any) {
      setStatus(prev => ({ 
        ...prev, 
        isScanning: false, 
        error: error.message || 'Gagal mencari printer' 
      }));
    }
  }, []);

  // Connect to a specific printer
  const connectPrinter = useCallback(async (device: BluetoothDevice) => {
    if (!isNative || !CapacitorThermalPrinter) {
      return false;
    }

    try {
      setStatus(prev => ({ ...prev, error: null }));
      
      await CapacitorThermalPrinter.connect({ address: device.address });
      
      setStatus(prev => ({ 
        ...prev, 
        isConnected: true, 
        connectedDevice: device 
      }));
      
      // Save to localStorage for reconnection
      localStorage.setItem('lastPrinter', JSON.stringify(device));
      
      return true;
    } catch (error: any) {
      setStatus(prev => ({ 
        ...prev, 
        error: error.message || 'Gagal koneksi ke printer' 
      }));
      return false;
    }
  }, []);

  // Disconnect from printer
  const disconnectPrinter = useCallback(async () => {
    if (!isNative || !CapacitorThermalPrinter) return;

    try {
      await CapacitorThermalPrinter.disconnect();
      setStatus(prev => ({ 
        ...prev, 
        isConnected: false, 
        connectedDevice: null 
      }));
      localStorage.removeItem('lastPrinter');
    } catch (error: any) {
      setStatus(prev => ({ 
        ...prev, 
        error: error.message || 'Gagal disconnect' 
      }));
    }
  }, []);

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
    if (!isNative || !CapacitorThermalPrinter) {
      // Fall back to web print
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
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(price);
      };

      // Build receipt using the plugin's API
      const printer = CapacitorThermalPrinter.begin();
      
      // Header
      await printer
        .align('center')
        .bold()
        .text('WARUNG MAKAN\n')
        .clearFormatting()
        .text('Sistem Kasir Digital\n')
        .text('Jl. Contoh No. 123\n')
        .text('--------------------------------\n')
        .align('left')
        .text(`No. Order: ${receiptData.orderNumber}\n`)
        .text(`Kasir: ${receiptData.cashierName}\n`);

      if (receiptData.tableNumber) {
        await printer.text(`Meja: ${receiptData.tableNumber}\n`);
      }

      const dateStr = receiptData.timestamp.toLocaleDateString('id-ID');
      const timeStr = receiptData.timestamp.toLocaleTimeString('id-ID');
      await printer
        .text(`Tanggal: ${dateStr}\n`)
        .text(`Waktu: ${timeStr}\n`)
        .text('--------------------------------\n');

      // Items
      for (const item of receiptData.items) {
        const itemTotal = item.price * item.quantity;
        await printer.text(`${item.quantity}x ${item.name}\n`);
        await printer.align('right').text(`${formatPrice(itemTotal)}\n`).align('left');
      }

      await printer.text('--------------------------------\n');

      // Totals
      await printer.text(`Subtotal: ${formatPrice(receiptData.subtotal)}\n`);
      
      if (receiptData.discount > 0) {
        await printer.text(`Diskon: -${formatPrice(receiptData.discount)}\n`);
      }
      
      await printer
        .bold()
        .text(`TOTAL: ${formatPrice(receiptData.total)}\n`)
        .clearFormatting()
        .text('--------------------------------\n')
        .text(`Bayar (${paymentMethodText[receiptData.paymentMethod] || receiptData.paymentMethod}): ${formatPrice(receiptData.amountPaid)}\n`)
        .text(`Kembali: ${formatPrice(receiptData.change)}\n`)
        .text('--------------------------------\n')
        .align('center')
        .text('Terima Kasih\n')
        .text('Selamat Menikmati!\n')
        .text('\n\n\n');

      // Print and cut paper
      await printer.cutPaper().write();

      setStatus(prev => ({ ...prev, isPrinting: false }));
      return true;
    } catch (error: any) {
      setStatus(prev => ({ 
        ...prev, 
        isPrinting: false, 
        error: error.message || 'Gagal mencetak struk' 
      }));
      return false;
    }
  }, [status.isConnected]);

  // Try to reconnect to last printer on mount
  useEffect(() => {
    if (!isNative) return;

    const lastPrinter = localStorage.getItem('lastPrinter');
    if (lastPrinter) {
      try {
        const device = JSON.parse(lastPrinter) as BluetoothDevice;
        connectPrinter(device).catch(console.error);
      } catch (e) {
        console.error('Failed to parse last printer:', e);
      }
    }
  }, [connectPrinter]);

  return {
    ...status,
    isNative,
    scanDevices,
    connectPrinter,
    disconnectPrinter,
    printReceipt,
  };
}
