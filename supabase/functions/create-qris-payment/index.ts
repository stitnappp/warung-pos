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
    const { order_id, amount, item_details } = await req.json()

    console.log('Creating QRIS payment:', { order_id, amount, item_details })

    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY')
    if (!serverKey) {
      throw new Error('MIDTRANS_SERVER_KEY is not configured')
    }

    // Determine if we're using sandbox or production
    // For sandbox, use sandbox URL. For production, remove 'sandbox-' prefix
    const isSandbox = serverKey.startsWith('SB-')
    const baseUrl = isSandbox 
      ? 'https://api.sandbox.midtrans.com'
      : 'https://api.midtrans.com'

    // Create the transaction request for QRIS
    const transactionDetails = {
      payment_type: 'qris',
      transaction_details: {
        order_id: order_id,
        gross_amount: amount,
      },
      qris: {
        acquirer: 'gopay', // You can also use 'airpay shopee' for ShopeePay
      },
      item_details: item_details || [],
    }

    console.log('Midtrans request:', JSON.stringify(transactionDetails, null, 2))

    // Call Midtrans Core API to create QRIS transaction
    const authString = btoa(`${serverKey}:`)
    const response = await fetch(`${baseUrl}/v2/charge`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(transactionDetails),
    })

    const data = await response.json()
    console.log('Midtrans response:', JSON.stringify(data, null, 2))

    if (data.status_code !== '201' && data.status_code !== '200') {
      console.error('Midtrans error:', data)
      throw new Error(data.status_message || 'Failed to create QRIS payment')
    }

    // Extract the QR code URL/string from the response
    const qrCodeUrl = data.actions?.find((action: any) => action.name === 'generate-qr-code')?.url
    const qrString = data.qr_string

    return new Response(
      JSON.stringify({
        status: 'success',
        transaction_id: data.transaction_id,
        order_id: data.order_id,
        qr_code_url: qrCodeUrl,
        qr_string: qrString,
        transaction_status: data.transaction_status,
        expiry_time: data.expiry_time,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error: unknown) {
    console.error('Error creating QRIS payment:', error)
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
