import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'POST') {
      const { orderNumber, total, cashierName, paymentMethod } = await req.json()
      
      console.log('Sending Telegram notification for order:', orderNumber)

      if (!telegramBotToken) {
        console.error('TELEGRAM_BOT_TOKEN not configured')
        return new Response(
          JSON.stringify({ status: 'error', message: 'Telegram bot token not configured' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      // Get admin notification settings
      const { data: settings, error: settingsError } = await supabase
        .from('notification_settings')
        .select('telegram_chat_id, notify_on_transaction, user_id')
        .eq('notify_on_transaction', true)
        .not('telegram_chat_id', 'is', null)

      if (settingsError) {
        console.error('Error fetching notification settings:', settingsError)
        throw settingsError
      }

      if (!settings || settings.length === 0) {
        console.log('No notification settings found')
        return new Response(
          JSON.stringify({ status: 'skipped', message: 'No notification settings configured' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }

      // Check if user is admin
      const adminSettings = []
      for (const setting of settings) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', setting.user_id)
          .eq('role', 'admin')
          .single()

        if (roleData) {
          adminSettings.push(setting)
        }
      }

      if (adminSettings.length === 0) {
        console.log('No admin notification settings found')
        return new Response(
          JSON.stringify({ status: 'skipped', message: 'No admin notification settings' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }

      // Format the message
      const paymentMethodLabel = paymentMethod === 'cash' ? 'Tunai' : 
                                 paymentMethod === 'qris' ? 'QRIS' : 
                                 paymentMethod === 'transfer' ? 'Transfer' : paymentMethod

      const message = `🔔 *Transaksi Baru*

📋 No. Order: ${orderNumber}
👤 Kasir: ${cashierName || 'Unknown'}
💰 Total: Rp ${total.toLocaleString('id-ID')}
💳 Pembayaran: ${paymentMethodLabel}
⏰ Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`

      // Send Telegram notifications to all admins
      const results = []
      for (const adminSetting of adminSettings) {
        const chatId = adminSetting.telegram_chat_id

        try {
          const telegramResponse = await fetch(
            `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
              }),
            }
          )

          const telegramResult = await telegramResponse.json()
          
          if (telegramResult.ok) {
            console.log(`Telegram notification sent to chat: ${chatId}`)
            results.push({
              chatId: chatId,
              status: 'sent',
            })
          } else {
            console.error(`Failed to send Telegram notification:`, telegramResult)
            results.push({
              chatId: chatId,
              status: 'failed',
              error: telegramResult.description,
            })
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`Error sending Telegram notification to ${chatId}:`, error)
          results.push({
            chatId: chatId,
            status: 'error',
            error: errorMessage,
          })
        }
      }

      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          message: 'Notifications sent',
          notifications: results 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  } catch (error: unknown) {
    console.error('Telegram notification error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
