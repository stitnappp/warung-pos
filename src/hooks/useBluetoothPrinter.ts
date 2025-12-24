import { useState, useCallback, useEffect } from 'react';
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

  const [bluetoothLE, setBluetoothLE] = useState<any>(null);
  const [thermalPrinter, setThermalPrinter] = useState<any>(null);

  // Load plugins dynamically
  useEffect(() => {
    if (!isNative) return;

    Promise.all([
      import('@capacitor-community/bluetooth-le'),
      import('capacitor-thermal-printer')
    ]).then(([bleModule, printerModule]) => {
      setBluetoothLE(bleModule.BleClient);
      setThermalPrinter(printerModule.CapacitorThermalPrinter);
    }).catch(console.error);
  }, []);

  // Scan for Bluetooth devices using BLE
  const scanDevices = useCallback(async () => {
    if (!isNative || !bluetoothLE) {
      setStatus(prev => ({ 
        ...prev, 
        error: 'Fitur ini hanya tersedia di aplikasi Android' 
      }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, isScanning: true, error: null, devices: [] }));
      
      // Initialize BLE
      await bluetoothLE.initialize();
      
      // Check if Bluetooth is enabled
      const isEnabled = await bluetoothLE.isEnabled();
      if (!isEnabled) {
        setStatus(prev => ({ 
          ...prev, 
          isScanning: false, 
          error: 'Bluetooth tidak aktif. Silakan aktifkan Bluetooth terlebih dahulu.' 
        }));
        return;
      }

      const foundDevices: BluetoothDevice[] = [];
      
      // Request Bluetooth scan
      await bluetoothLE.requestLEScan(
        { 
          allowDuplicates: false,
        },
        (result: any) => {
          if (result.device && result.device.deviceId) {
            const deviceName = result.device.name || result.localName || 'Unknown Device';
            const device: BluetoothDevice = {
              name: deviceName,
              address: result.device.deviceId,
            };
            
            // Prioritize Eppos and thermal printer devices
            const isEppos = deviceName.toLowerCase().includes('eppos');
            const isPrinter = deviceName.toLowerCase().includes('printer') || 
                             deviceName.toLowerCase().includes('pos') ||
                             deviceName.toLowerCase().includes('thermal') ||
                             deviceName.toLowerCase().includes('bt-') ||
                             deviceName.toLowerCase().includes('bluetooth');
            
            // Only add if not already in list
            if (!foundDevices.some(d => d.address === device.address)) {
              // Add Eppos/printer devices at the beginning
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
        }
      );

      // Stop scanning after 10 seconds
      setTimeout(async () => {
        try {
          await bluetoothLE.stopLEScan();
        } catch (e) {
          console.log('Scan already stopped');
        }
        setStatus(prev => ({ ...prev, isScanning: false }));
      }, 10000);

    } catch (error: any) {
      console.error('Scan error:', error);
      setStatus(prev => ({ 
        ...prev, 
        isScanning: false, 
        error: error.message || 'Gagal mencari printer. Pastikan Bluetooth aktif dan izin diberikan.' 
      }));
    }
  }, [bluetoothLE]);

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

      await thermalPrinter.begin()
        .align('center')
        .bold()
        .doubleWidth()
        .text('TEST PRINT\n')
        .clearFormatting()
        .text('================================\n')
        .text('Printer Eppos Terhubung!\n')
        .text(`Tanggal: ${dateStr}\n`)
        .text(`Waktu: ${timeStr}\n`)
        .text('================================\n')
        .text('RM.MINANG MAIMBAOE\n')
        .text('Sistem Kasir Digital\n')
        .text('\n\n\n')
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

      // Build receipt using the plugin's API
      let printer = thermalPrinter.begin();
      
      // Header - Restaurant name with double size
      printer = printer
        .align('center')
        .bold()
        .doubleWidth()
        .text('RM.MINANG MAIMBAOE\n')
        .clearFormatting()
        .align('center')
        .text('Sistem Kasir Digital\n')
        .text('Jln. Gatot Subroto no.10\n')
        .text('Depan Balai Desa Losari Kidul\n')
        .text('Kec. Losari, Kab. Cirebon\n')
        .text('================================\n');

      // Order info
      printer = printer
        .align('left')
        .text(`No. Order : ${receiptData.orderNumber}\n`)
        .text(`Kasir     : ${receiptData.cashierName}\n`);

      if (receiptData.tableNumber) {
        printer = printer.text(`Meja      : ${receiptData.tableNumber}\n`);
      }

      printer = printer
        .text(`Tanggal   : ${dateStr}\n`)
        .text(`Waktu     : ${timeStr}\n`)
        .text('--------------------------------\n');

      // Items
      for (const item of receiptData.items) {
        const itemTotal = item.price * item.quantity;
        printer = printer
          .align('left')
          .text(`${item.quantity}x ${item.name}\n`)
          .align('right')
          .text(`Rp ${formatPrice(itemTotal)}\n`);
      }

      printer = printer.align('left').text('--------------------------------\n');

      // Totals
      printer = printer
        .text(`Subtotal      : Rp ${formatPrice(receiptData.subtotal)}\n`);
      
      if (receiptData.discount > 0) {
        printer = printer.text(`Diskon        : -Rp ${formatPrice(receiptData.discount)}\n`);
      }
      
      printer = printer
        .bold()
        .text(`TOTAL         : Rp ${formatPrice(receiptData.total)}\n`)
        .clearFormatting()
        .text('--------------------------------\n')
        .text(`Bayar (${paymentMethodText[receiptData.paymentMethod] || receiptData.paymentMethod})\n`)
        .text(`              : Rp ${formatPrice(receiptData.amountPaid)}\n`)
        .text(`Kembali       : Rp ${formatPrice(receiptData.change)}\n`)
        .text('================================\n')
        .align('center')
        .text('Terima Kasih\n')
        .text('Selamat Menikmati!\n')
        .text('================================\n')
        .text('\n\n\n');

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
