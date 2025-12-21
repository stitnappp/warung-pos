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
      const payload = await req.json()
      
      console.log('Received Midtrans webhook:', JSON.stringify(payload, null, 2))

      // Extract payment information from Midtrans payload
      const {
        order_id,
        transaction_id,
        payment_type,
        transaction_status,
        gross_amount,
        currency,
        transaction_time,
      } = payload

      // Only process successful payments (settlement for most payment types)
      const successStatuses = ['settlement', 'capture', 'accept']
      
      if (successStatuses.includes(transaction_status)) {
        // Insert payment notification
        const { data, error } = await supabase
          .from('payment_notifications')
          .insert({
            order_id: order_id,
            transaction_id: transaction_id,
            payment_type: payment_type,
            transaction_status: transaction_status,
            gross_amount: parseFloat(gross_amount),
            currency: currency || 'IDR',
            transaction_time: transaction_time ? new Date(transaction_time).toISOString() : new Date().toISOString(),
            raw_payload: payload,
            is_read: false,
          })
          .select()
          .single()

        if (error) {
          console.error('Error inserting payment notification:', error)
          throw error
        }

        console.log('Payment notification saved:', data)
      } else {
        console.log(`Skipping notification for status: ${transaction_status}`)
      }

      return new Response(
        JSON.stringify({ status: 'ok' }),
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
    console.error('Webhook error:', error)
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
