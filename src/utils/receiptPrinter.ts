import { CartItem } from '@/hooks/useOrders';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

interface ReceiptData {
  orderNumber: string;
  cashierName: string;
  tableNumber?: number;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  timestamp: Date;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(price);
}

export function generateReceiptHTML(data: ReceiptData): string {
  const itemsHTML = data.items.map(item => `
    <tr>
      <td style="text-align: left;">${item.quantity}x ${item.name}</td>
      <td style="text-align: right;">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const paymentMethodText = {
    cash: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
  }[data.paymentMethod] || data.paymentMethod;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Struk #${data.orderNumber}</title>
      <style>
        @page {
          margin: 0;
          size: 58mm auto;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 7px;
          width: 58mm;
          padding: 2mm;
          color: #000;
          background: #fff;
          line-height: 1.2;
        }
        .header {
          text-align: center;
          margin-bottom: 4px;
          border-bottom: 1px dashed #000;
          padding-bottom: 4px;
        }
        .header h1 {
          font-size: 9px;
          font-weight: bold;
          margin-bottom: 2px;
        }
        .header p {
          font-size: 6px;
          line-height: 1.1;
        }
        .info {
          margin: 4px 0;
          font-size: 6px;
        }
        .info p {
          margin: 1px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 4px 0;
        }
        td {
          padding: 1px 0;
          font-size: 6px;
          vertical-align: top;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 4px 0;
        }
        .totals {
          margin: 4px 0;
        }
        .totals p {
          display: flex;
          justify-content: space-between;
          margin: 1px 0;
          font-size: 6px;
        }
        .totals .total {
          font-weight: bold;
          font-size: 8px;
          margin-top: 2px;
        }
        .footer {
          text-align: center;
          margin-top: 6px;
          font-size: 6px;
        }
        .print-btn {
          display: block;
          width: 100%;
          padding: 10px;
          margin-top: 15px;
          background: #4CAF50;
          color: white;
          border: none;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          border-radius: 8px;
        }
        @media print {
          body {
            width: 58mm;
          }
          .print-btn {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🍽️ RM.MINANG MAIMBAOE</h1>
        <p>Sistem Kasir Digital</p>
        <p>Jln. Gatot Subroto no.10</p>
        <p>Depan Balai Desa Losari Kidul</p>
        <p>Kec. Losari, Kab. Cirebon, 45192</p>
      </div>
      
      <div class="info">
        <p><strong>No. Order:</strong> ${data.orderNumber}</p>
        <p><strong>Kasir:</strong> ${data.cashierName}</p>
        ${data.tableNumber ? `<p><strong>Meja:</strong> ${data.tableNumber}</p>` : ''}
        <p><strong>Tanggal:</strong> ${data.timestamp.toLocaleDateString('id-ID')}</p>
        <p><strong>Waktu:</strong> ${data.timestamp.toLocaleTimeString('id-ID')}</p>
      </div>
      
      <div class="divider"></div>
      
      <table>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      
      <div class="divider"></div>
      
      <div class="totals">
        <p><span>Subtotal</span><span>${formatPrice(data.subtotal)}</span></p>
        ${data.discount > 0 ? `<p><span>Diskon</span><span>-${formatPrice(data.discount)}</span></p>` : ''}
        <p class="total"><span>TOTAL</span><span>${formatPrice(data.total)}</span></p>
        <div class="divider"></div>
        <p><span>Bayar (${paymentMethodText})</span><span>${formatPrice(data.amountPaid)}</span></p>
        <p><span>Kembali</span><span>${formatPrice(data.change)}</span></p>
      </div>
      
      <div class="footer">
        <p>================================</p>
        <p>Terima Kasih</p>
        <p>Selamat Menikmati!</p>
        <p>================================</p>
      </div>
      
      <button class="print-btn" onclick="window.print()">🖨️ Cetak Struk</button>
    </body>
    </html>
  `;
}

export async function printReceipt(data: ReceiptData): Promise<void> {
  const receiptHTML = generateReceiptHTML(data);
  
  // Create a data URL from the HTML
  const base64HTML = btoa(unescape(encodeURIComponent(receiptHTML)));
  const dataUrl = `data:text/html;base64,${base64HTML}`;
  
  // Check if running on native platform (Android/iOS)
  if (Capacitor.isNativePlatform()) {
    // Open in external browser (Chrome on Android)
    try {
      await Browser.open({ 
        url: dataUrl,
        presentationStyle: 'fullscreen'
      });
    } catch (error) {
      console.error('Failed to open browser:', error);
      // Fallback to in-app window
      openPrintWindow(receiptHTML);
    }
  } else {
    // Web fallback
    openPrintWindow(receiptHTML);
  }
}

function openPrintWindow(receiptHTML: string): void {
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  if (printWindow) {
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
      }, 500);
    };
  }
}
