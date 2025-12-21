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
    const { order_id } = await req.json()

    console.log('Checking payment status for order:', order_id)

    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY')
    if (!serverKey) {
      throw new Error('MIDTRANS_SERVER_KEY is not configured')
    }

    // Determine if we're using sandbox or production
    const isSandbox = serverKey.startsWith('SB-')
    const baseUrl = isSandbox 
      ? 'https://api.sandbox.midtrans.com'
      : 'https://api.midtrans.com'

    // Call Midtrans API to check transaction status
    const authString = btoa(`${serverKey}:`)
    const response = await fetch(`${baseUrl}/v2/${order_id}/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
    })

    const data = await response.json()
    console.log('Midtrans status response:', JSON.stringify(data, null, 2))

    // Determine if payment is successful
    const successStatuses = ['settlement', 'capture', 'accept']
    const pendingStatuses = ['pending', 'authorize']
    const failedStatuses = ['deny', 'cancel', 'expire', 'failure']

    let status = 'unknown'
    if (successStatuses.includes(data.transaction_status)) {
      status = 'success'
    } else if (pendingStatuses.includes(data.transaction_status)) {
      status = 'pending'
    } else if (failedStatuses.includes(data.transaction_status)) {
      status = 'failed'
    }

    return new Response(
      JSON.stringify({
        status,
        transaction_status: data.transaction_status,
        order_id: data.order_id,
        transaction_id: data.transaction_id,
        payment_type: data.payment_type,
        gross_amount: data.gross_amount,
        transaction_time: data.transaction_time,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error: unknown) {
    console.error('Error checking payment status:', error)
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
