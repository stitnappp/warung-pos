import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate DOKU signature for GET requests
async function generateGetSignature(
  clientId: string,
  secretKey: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string
): Promise<string> {
  // Create component signature for GET (no body/digest)
  const componentSignature = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}`;

  // Create HMAC-SHA256 signature
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(componentSignature)
  );

  return base64Encode(signatureBuffer);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { order_id } = await req.json()

    console.log('Checking DOKU payment status for order:', order_id)

    const clientId = Deno.env.get('DOKU_CLIENT_ID')
    const secretKey = Deno.env.get('DOKU_SECRET_KEY')

    if (!clientId || !secretKey) {
      // Fallback: Check from payment_notifications table
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { data: notification } = await supabase
        .from('payment_notifications')
        .select('*')
        .eq('order_id', order_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (notification) {
        const successStatuses = ['settlement', 'SUCCESS', 'PAID']
        const status = successStatuses.includes(notification.transaction_status) ? 'success' : 'pending'
        
        return new Response(
          JSON.stringify({
            status,
            transaction_status: notification.transaction_status,
            order_id: notification.order_id,
            transaction_id: notification.transaction_id,
            payment_type: notification.payment_type,
            gross_amount: notification.gross_amount,
            transaction_time: notification.transaction_time,
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }

      return new Response(
        JSON.stringify({
          status: 'pending',
          order_id: order_id,
          message: 'Payment status not found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Use DOKU API to check status
    const isSandbox = true
    const baseUrl = isSandbox 
      ? 'https://api-sandbox.doku.com'
      : 'https://api.doku.com'

    const requestTarget = `/orders/v1/status/${order_id}`
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

    const signature = await generateGetSignature(
      clientId,
      secretKey,
      requestId,
      requestTimestamp,
      requestTarget
    )

    const response = await fetch(`${baseUrl}${requestTarget}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Client-Id': clientId,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        'Request-Target': requestTarget,
        'Signature': `HMACSHA256=${signature}`
      }
    })

    const data = await response.json()
    console.log('DOKU status response:', JSON.stringify(data, null, 2))

    // Map DOKU status
    const transactionStatus = data.transaction?.status || data.order?.status || 'PENDING'
    const successStatuses = ['SUCCESS', 'PAID', 'COMPLETED']
    const pendingStatuses = ['PENDING', 'CREATED']
    const failedStatuses = ['FAILED', 'EXPIRED', 'CANCELLED']

    let status = 'unknown'
    if (successStatuses.includes(transactionStatus)) {
      status = 'success'
    } else if (pendingStatuses.includes(transactionStatus)) {
      status = 'pending'
    } else if (failedStatuses.includes(transactionStatus)) {
      status = 'failed'
    }

    return new Response(
      JSON.stringify({
        status,
        transaction_status: transactionStatus,
        order_id: data.order?.invoice_number || order_id,
        transaction_id: data.transaction?.id,
        payment_type: 'qris',
        gross_amount: data.order?.amount,
        transaction_time: data.transaction?.date,
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
