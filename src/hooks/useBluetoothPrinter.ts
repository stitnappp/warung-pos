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
const FONT_SIZE_STORAGE_KEY = 'eppos_printer_font_size';

type PrinterFontSize = 'small' | 'normal' | 'large';

const FONT_SIZE_CONFIG: Record<PrinterFontSize, { chars: number }> = {
  small: { chars: 42 },
  normal: { chars: 32 },
  large: { chars: 24 },
};

const getPrinterFontSize = (): PrinterFontSize => {
  const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
  if (saved && (saved === 'small' || saved === 'normal' || saved === 'large')) {
    return saved;
  }
  return 'normal';
};

const applyFontSize = (printer: any, size: PrinterFontSize) => {
  // Note: this maps "ukuran font" to capabilities the plugin supports.
  // Some printers may ignore certain modes; this is still safe to call.
  if (!printer) return printer;

  if (size === 'small') {
    return printer.font('B').doubleWidth(false).doubleHeight(false);
  }

  if (size === 'large') {
    return printer.font('A').doubleWidth(true).doubleHeight(true);
  }

  return printer.font('A').doubleWidth(false).doubleHeight(false);
};

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

      const fontSize = getPrinterFontSize();
      const lineWidth = FONT_SIZE_CONFIG[fontSize].chars;
      const dateStr = new Date().toLocaleDateString('id-ID');
      const timeStr = new Date().toLocaleTimeString('id-ID');
      const lineStr = '-'.repeat(lineWidth);

      // Use plugin's builder API (Android implementation) then write()
      // Set encoding to PC437 (Latin) to prevent Chinese characters
      let printer = thermalPrinter.begin().clearFormatting().charsetEncoding('PC437');
      printer = applyFontSize(printer, fontSize);

      const receiptText =
        `TEST PRINT\n` +
        `${lineStr}\n` +
        `Printer Terhubung!\n` +
        `Font: ${fontSize} (${lineWidth} chars)\n` +
        `${dateStr} ${timeStr}\n` +
        `${lineStr}\n` +
        `RM.MINANG MAIMBAOE\n\n\n`;

      await printer
        .align('center')
        .bold()
        .textCustom(receiptText, { encoding: 'ASCII' })
        .bold(false)
        .feedCutPaper()
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
    restaurantSettings?: {
      restaurant_name: string;
      address_line1: string | null;
      address_line2: string | null;
      address_line3: string | null;
      whatsapp_number: string | null;
      instagram_handle: string | null;
      footer_message: string | null;
    };
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

      // Get font size from settings
      const fontSize = getPrinterFontSize();
      const LINE_WIDTH = FONT_SIZE_CONFIG[fontSize].chars;

      // Get restaurant settings or use defaults
      const rs = receiptData.restaurantSettings;
      const restaurantName = rs?.restaurant_name || 'RM.MINANG MAIMBAOE';
      const addressLine1 = rs?.address_line1 || '';
      const addressLine2 = rs?.address_line2 || '';
      const addressLine3 = rs?.address_line3 || '';
      const footerMessage = rs?.footer_message || 'Terima Kasih!';

      // Helper functions for text formatting based on LINE_WIDTH
      const line = '-'.repeat(LINE_WIDTH);
      const doubleLine = '='.repeat(LINE_WIDTH);
      
      // Create two-column line: left text + right text
      const twoColumn = (left: string, right: string) => {
        const rightLen = right.length;
        const leftMax = LINE_WIDTH - rightLen - 1;
        const leftTrimmed = left.slice(0, leftMax);
        const spaces = LINE_WIDTH - leftTrimmed.length - rightLen;
        return leftTrimmed + ' '.repeat(Math.max(1, spaces)) + right;
      };
      
      // Print using plugin builder API (implemented on Android)
      // Set encoding to PC437 (Latin) to prevent Chinese characters
      let printer = thermalPrinter.begin().clearFormatting().charsetEncoding('PC437');
      printer = applyFontSize(printer, fontSize);

      // Build receipt text as single string to use textCustom with ASCII encoding
      let receiptText = '';
      
      // Header + address (center aligned)
      receiptText += `${restaurantName}\n`;
      if (addressLine1) receiptText += `${addressLine1}\n`;
      if (addressLine2) receiptText += `${addressLine2}\n`;
      if (addressLine3) receiptText += `${addressLine3}\n`;
      receiptText += `${doubleLine}\n`;

      // Order info
      receiptText += `No: ${receiptData.orderNumber}\n`;
      receiptText += `Kasir: ${receiptData.cashierName}\n`;
      if (receiptData.tableNumber) {
        receiptText += `Meja: ${receiptData.tableNumber}\n`;
      }
      receiptText += `${dateStr} ${timeStr}\n`;
      receiptText += `${line}\n`;

      // Items
      for (const item of receiptData.items) {
        const itemTotal = item.price * item.quantity;
        const priceStr = formatPrice(itemTotal);
        const itemLine = twoColumn(`${item.quantity}x ${item.name}`, priceStr);
        receiptText += `${itemLine}\n`;
      }

      receiptText += `${line}\n`;

      // Totals
      if (receiptData.discount > 0) {
        receiptText += `${twoColumn('Subtotal', 'Rp' + formatPrice(receiptData.subtotal))}\n`;
        receiptText += `${twoColumn('Diskon', '-Rp' + formatPrice(receiptData.discount))}\n`;
      }

      receiptText += `${twoColumn('TOTAL', 'Rp' + formatPrice(receiptData.total))}\n`;
      receiptText += `${line}\n`;

      // Payment
      const payMethod = paymentMethodText[receiptData.paymentMethod] || receiptData.paymentMethod;
      receiptText += `${twoColumn(payMethod, 'Rp' + formatPrice(receiptData.amountPaid))}\n`;
      if (receiptData.change > 0) {
        receiptText += `${twoColumn('Kembali', 'Rp' + formatPrice(receiptData.change))}\n`;
      }

      // Footer
      receiptText += `${doubleLine}\n`;
      receiptText += `${footerMessage}\n\n\n`;

      await printer
        .align('center')
        .textCustom(receiptText, { encoding: 'ASCII' })
        .feedCutPaper()
        .write();

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
