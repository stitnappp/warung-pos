import { CartItem } from '@/hooks/useOrders';

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
          size: 80mm auto;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 80mm;
          padding: 5mm;
          color: #000;
          background: #fff;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .header h1 {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .header p {
          font-size: 11px;
        }
        .info {
          margin: 10px 0;
          font-size: 11px;
        }
        .info p {
          margin: 2px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        td {
          padding: 3px 0;
          font-size: 11px;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 10px 0;
        }
        .totals {
          margin: 10px 0;
        }
        .totals p {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 11px;
        }
        .totals .total {
          font-weight: bold;
          font-size: 14px;
          margin-top: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 15px;
          font-size: 10px;
        }
        @media print {
          body {
            width: 80mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🍽️ WARUNG MAKAN</h1>
        <p>Sistem Kasir Digital</p>
        <p>Jl. Contoh No. 123</p>
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
    </body>
    </html>
  `;
}

export function printReceipt(data: ReceiptData): void {
  const receiptHTML = generateReceiptHTML(data);
  
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
