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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'POST') {
      const { orderNumber, total, cashierName, paymentMethod } = await req.json()
      
      console.log('Sending WhatsApp notification for order:', orderNumber)

      // Get admin notification settings
      const { data: settings, error: settingsError } = await supabase
        .from('notification_settings')
        .select('whatsapp_number, notify_on_transaction, user_id')
        .eq('notify_on_transaction', true)
        .not('whatsapp_number', 'is', null)

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

      // Send WhatsApp notifications to all admins
      const results = []
      for (const adminSetting of adminSettings) {
        const phoneNumber = adminSetting.whatsapp_number.replace(/\D/g, '')
        const formattedPhone = phoneNumber.startsWith('0') 
          ? '62' + phoneNumber.slice(1) 
          : phoneNumber.startsWith('62') 
            ? phoneNumber 
            : '62' + phoneNumber

        // Using WhatsApp API URL (wa.me for deep linking)
        // In production, you would use WhatsApp Business API
        const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
        
        results.push({
          phone: formattedPhone,
          message: message,
          waLink: waLink,
          status: 'prepared'
        })

        console.log(`WhatsApp notification prepared for: ${formattedPhone}`)
      }

      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          message: 'Notifications prepared',
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
    console.error('WhatsApp notification error:', error)
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
