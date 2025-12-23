import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function extractDokuMessage(data: any): string {
  const msgFromArray = Array.isArray(data?.message) ? data.message[0] : null;
  return (
    msgFromArray ||
    data?.message?.en ||
    data?.error?.message ||
    data?.error?.code ||
    "Failed to create QRIS payment"
  );
}

function toFriendlyMessage(rawMessage: string): string {
  const upper = String(rawMessage).toUpperCase();
  if (upper.includes("PAYMENT CHANNEL IS INACTIVE")) {
    return "Channel QRIS di DOKU belum aktif. Aktifkan layanan QRIS/QR Payment di akun DOKU kamu (Settings → Service → Add Service → QRIS) atau minta tim DOKU mengaktifkan QRIS untuk Checkout.";
  }
  if (upper.includes("INVALID CLIENT-ID") || upper.includes("INVALID_CLIENT_ID")) {
    return "Client ID tidak cocok (cek apakah credential sandbox vs production sudah sesuai).";
  }
  return rawMessage;
}

// Generate DOKU signature
async function generateSignature(
  clientId: string,
  secretKey: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  body: string
): Promise<{ signature: string; digest: string }> {
  // Digest = base64(sha256(body))
  const bodyBytes = new TextEncoder().encode(body);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bodyBytes);
  const digest = base64Encode(hashBuffer);

  // Prepare signature component
  const componentSignature = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;

  // HMAC-SHA256(componentSignature)
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

  return { signature: base64Encode(signatureBuffer), digest };
}

function generateRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, amount, item_details } = await req.json();

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return jsonResponse({
        status: "error",
        error: "Total pembayaran harus lebih dari 0 (IDR).",
      });
    }

    console.log("Creating DOKU QRIS payment:", {
      order_id,
      amount: normalizedAmount,
      item_details,
    });

    const clientId = Deno.env.get("DOKU_CLIENT_ID")?.trim();
    const secretKey = Deno.env.get("DOKU_SECRET_KEY")?.trim();

    if (!clientId || !secretKey) {
      return jsonResponse({
        status: "error",
        error: "DOKU credentials are not configured",
      });
    }

    // Try sandbox first, then production (helps if the credentials are for a different environment)
    const baseUrls = ["https://api-sandbox.doku.com", "https://api.doku.com"];

    const requestTarget = "/checkout/v1/payment";
    const requestId = generateRequestId();
    // DOKU examples use timestamps without milliseconds
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    const requestBody = {
      order: {
        amount: normalizedAmount,
        invoice_number: order_id,
        currency: "IDR",
        callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/doku-webhook`,
        line_items:
          item_details?.map((item: any) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })) || [],
      },
      payment: {
        payment_due_date: 60, // 60 minutes expiry
        payment_method_types: ["QRIS"],
      },
      customer: {
        name: "Customer",
        email: "customer@example.com",
      },
    };

    const bodyString = JSON.stringify(requestBody);

    const { signature, digest } = await generateSignature(
      clientId,
      secretKey,
      requestId,
      requestTimestamp,
      requestTarget,
      bodyString
    );

    let lastResponse: Response | null = null;
    let lastData: any = null;

    for (const baseUrl of baseUrls) {
      console.log("DOKU request:", {
        url: `${baseUrl}${requestTarget}`,
        requestId,
        requestTimestamp,
        body: requestBody,
      });

      const response = await fetch(`${baseUrl}${requestTarget}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Client-Id": clientId,
          "Request-Id": requestId,
          "Request-Timestamp": requestTimestamp,
          "Request-Target": requestTarget,
          Digest: digest,
          Signature: `HMACSHA256=${signature}`,
        },
        body: bodyString,
      });

      const data = await response.json().catch(() => ({}));
      console.log("DOKU response:", JSON.stringify(data, null, 2));

      lastResponse = response;
      lastData = data;

      // If client-id is invalid for this environment, try the other baseUrl
      const invalidClientId = data?.error?.code === "invalid_client_id";
      if (invalidClientId) {
        console.error("DOKU invalid client id for baseUrl:", baseUrl);
        continue;
      }

      if (!response.ok) {
        const rawMessage = extractDokuMessage(data);
        const friendlyMessage = toFriendlyMessage(rawMessage);

        console.error("DOKU error:", data);
        return jsonResponse({
          status: "error",
          error: friendlyMessage,
          doku_code: data?.error?.code || null,
        });
      }

      // Extract QR code info from response
      const qrisPayment = data.payment?.qris || data.response?.payment?.qris;
      const qrString = qrisPayment?.qr_content || data.qr_string || null;
      const qrCodeUrl = qrisPayment?.qr_url || null;

      return jsonResponse({
        status: "success",
        transaction_id: data.order?.invoice_number || order_id,
        order_id,
        qr_code_url: qrCodeUrl,
        qr_string: qrString,
        transaction_status: "pending",
        expiry_time:
          data.order?.expired_date ||
          new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        checkout_url:
          data.response?.payment?.url ||
          data.payment_url ||
          data.payment?.url ||
          null,
      });
    }

    // If we got here, both environments failed
    if (lastResponse && lastData?.error?.code === "invalid_client_id") {
      return jsonResponse({
        status: "error",
        error: "Client ID tidak cocok (cek apakah credential sandbox vs production sudah sesuai).",
      });
    }

    const rawMessage = extractDokuMessage(lastData);
    return jsonResponse({
      status: "error",
      error: toFriendlyMessage(rawMessage),
    });
  } catch (error: unknown) {
    console.error("Error creating DOKU QRIS payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Return 200 so the frontend can always read the error message from JSON
    return jsonResponse({ status: "error", error: errorMessage });
  }
});
