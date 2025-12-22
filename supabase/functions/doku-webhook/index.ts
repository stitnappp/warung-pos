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
    const payload = await req.json()
    console.log('DOKU webhook received:', JSON.stringify(payload, null, 2))

    // Extract transaction details from DOKU webhook
    const orderId = payload.order?.invoice_number || payload.transaction?.original_request_id
    const transactionId = payload.transaction?.id || payload.order?.invoice_number
    const transactionStatus = payload.transaction?.status || payload.order?.status
    const amount = payload.order?.amount || payload.transaction?.amount
    const paymentType = 'qris'

    // Map DOKU status to our status
    let mappedStatus = 'pending'
    if (transactionStatus === 'SUCCESS' || transactionStatus === 'PAID') {
      mappedStatus = 'settlement'
    } else if (transactionStatus === 'FAILED' || transactionStatus === 'EXPIRED') {
      mappedStatus = 'failed'
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Store the notification
    const { error: insertError } = await supabase
      .from('payment_notifications')
      .insert({
        order_id: orderId,
        transaction_id: transactionId,
        transaction_status: mappedStatus,
        payment_type: paymentType,
        gross_amount: amount,
        transaction_time: new Date().toISOString(),
        raw_payload: payload,
        is_read: false
      })

    if (insertError) {
      console.error('Error storing payment notification:', insertError)
    } else {
      console.log('Payment notification stored successfully')
    }

    // If payment is successful, try to send Telegram notification
    if (mappedStatus === 'settlement') {
      try {
        // Get notification settings
        const { data: notifSettings } = await supabase
          .from('notification_settings')
          .select('telegram_chat_id')
          .not('telegram_chat_id', 'is', null)
          .limit(1)
          .single()

        if (notifSettings?.telegram_chat_id) {
          const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
          if (telegramToken) {
            const message = `✅ *Pembayaran QRIS Berhasil*\n\nOrder: ${orderId}\nJumlah: Rp ${Number(amount).toLocaleString('id-ID')}\nWaktu: ${new Date().toLocaleString('id-ID')}`
            
            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: notifSettings.telegram_chat_id,
                text: message,
                parse_mode: 'Markdown'
              })
            })
          }
        }
      } catch (telegramError) {
        console.error('Error sending Telegram notification:', telegramError)
      }
    }

    return new Response(
      JSON.stringify({ status: 'ok' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error: unknown) {
    console.error('Error processing DOKU webhook:', error)
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
