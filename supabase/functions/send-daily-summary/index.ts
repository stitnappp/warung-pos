import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!telegramToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Telegram not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all notification settings with telegram configured
    const { data: settings, error: settingsError } = await supabase
      .from('notification_settings')
      .select('telegram_chat_id')
      .not('telegram_chat_id', 'is', null)
      .eq('notify_on_transaction', true);

    if (settingsError) {
      console.error('Error fetching notification settings:', settingsError);
      throw settingsError;
    }

    if (!settings || settings.length === 0) {
      console.log('No Telegram notifications configured');
      return new Response(JSON.stringify({ message: 'No notifications configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch today's completed orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .eq('status', 'completed');

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    // Calculate statistics
    const totalOrders = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
    const cashRevenue = orders?.filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + (o.total || 0), 0) || 0;
    const transferRevenue = orders?.filter(o => o.payment_method === 'transfer').reduce((sum, o) => sum + (o.total || 0), 0) || 0;
    const qrisRevenue = orders?.filter(o => o.payment_method === 'qris').reduce((sum, o) => sum + (o.total || 0), 0) || 0;

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    // Format date
    const dateStr = today.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Build message
    const message = `📊 *LAPORAN HARIAN*
📅 ${dateStr}

━━━━━━━━━━━━━━━━━━
📦 Total Pesanan: *${totalOrders}*
💰 Total Pendapatan: *${formatCurrency(totalRevenue)}*
━━━━━━━━━━━━━━━━━━

💵 Tunai: ${formatCurrency(cashRevenue)}
🏦 Transfer: ${formatCurrency(transferRevenue)}
📱 QRIS: ${formatCurrency(qrisRevenue)}

━━━━━━━━━━━━━━━━━━
_Laporan otomatis dari sistem POS_`;

    // Send to all configured chat IDs
    const results = [];
    for (const setting of settings) {
      if (setting.telegram_chat_id) {
        try {
          const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
          const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: setting.telegram_chat_id,
              text: message,
              parse_mode: 'Markdown',
            }),
          });

          const result = await response.json();
          console.log(`Telegram send result for ${setting.telegram_chat_id}:`, result);
          results.push({ chat_id: setting.telegram_chat_id, success: result.ok });
        } catch (err: unknown) {
          console.error(`Error sending to ${setting.telegram_chat_id}:`, err);
          results.push({ chat_id: setting.telegram_chat_id, success: false, error: String(err) });
        }
      }
    }

    // Save daily report to database
    const { data: reportData, error: reportError } = await supabase
      .from('daily_reports')
      .upsert({
        report_date: today.toISOString().split('T')[0],
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        cash_revenue: cashRevenue,
        transfer_revenue: transferRevenue,
        qris_revenue: qrisRevenue,
      }, {
        onConflict: 'report_date'
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error saving daily report:', reportError);
    }

    // Create accounting entries for daily settlement
    if (reportData && totalRevenue > 0) {
      const reportDate = today.toISOString().split('T')[0];
      
      // Get previous balance
      const { data: lastEntry } = await supabase
        .from('accounting_entries')
        .select('balance')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      const previousBalance = lastEntry?.balance || 0;
      const newBalance = previousBalance + totalRevenue;
      
      // Create accounting entries for each payment method
      const accountingEntries = [];
      
      if (cashRevenue > 0) {
        accountingEntries.push({
          entry_date: reportDate,
          entry_type: 'income',
          description: `Pendapatan Tunai - ${dateStr}`,
          debit: cashRevenue,
          credit: 0,
          balance: 0, // Will update after
          reference_id: reportData.id,
          reference_type: 'daily_report',
          payment_method: 'cash',
        });
      }
      
      if (transferRevenue > 0) {
        accountingEntries.push({
          entry_date: reportDate,
          entry_type: 'income',
          description: `Pendapatan Transfer - ${dateStr}`,
          debit: transferRevenue,
          credit: 0,
          balance: 0,
          reference_id: reportData.id,
          reference_type: 'daily_report',
          payment_method: 'transfer',
        });
      }
      
      if (qrisRevenue > 0) {
        accountingEntries.push({
          entry_date: reportDate,
          entry_type: 'income',
          description: `Pendapatan QRIS - ${dateStr}`,
          debit: qrisRevenue,
          credit: 0,
          balance: 0,
          reference_id: reportData.id,
          reference_type: 'daily_report',
          payment_method: 'qris',
        });
      }
      
      // Add summary entry
      accountingEntries.push({
        entry_date: reportDate,
        entry_type: 'daily_summary',
        description: `Total Settlement - ${dateStr} (${totalOrders} pesanan)`,
        debit: totalRevenue,
        credit: 0,
        balance: newBalance,
        reference_id: reportData.id,
        reference_type: 'daily_report',
        payment_method: null,
      });

      // Delete existing entries for today to avoid duplicates
      await supabase
        .from('accounting_entries')
        .delete()
        .eq('entry_date', reportDate);

      // Insert new accounting entries
      const { error: accountingError } = await supabase
        .from('accounting_entries')
        .insert(accountingEntries);

      if (accountingError) {
        console.error('Error creating accounting entries:', accountingError);
      } else {
        console.log('Accounting entries created successfully');
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Daily summary sent',
      results,
      stats: { totalOrders, totalRevenue, cashRevenue, transferRevenue, qrisRevenue }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in send-daily-summary:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
