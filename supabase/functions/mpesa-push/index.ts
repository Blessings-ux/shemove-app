// supabase/functions/mpesa-push/index.ts
// M-Pesa STK Push Edge Function using Safaricom Daraja API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight for React Frontend
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phoneNumber, amount, accountReference, rideId } = await req.json();

    // Validate input
    if (!phoneNumber || !amount) {
      throw new Error("Phone number and amount are required");
    }

    // Format phone number (remove + and ensure 254 prefix)
    let formattedPhone = phoneNumber.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    // Environment Variables (Set in Supabase Dashboard or via CLI)
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const shortcode = Deno.env.get("MPESA_SHORTCODE") || "174379"; // Sandbox default
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL");
    const environment = Deno.env.get("MPESA_ENVIRONMENT") || "sandbox";

    if (!consumerKey || !consumerSecret || !passkey) {
      throw new Error("M-Pesa credentials not configured");
    }

    // Select API base URL based on environment
    const baseUrl =
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    // 1. Generate OAuth Token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    console.log("Requesting OAuth token from:", `${baseUrl}/oauth/v1/generate`);

    const tokenResp = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    const tokenText = await tokenResp.text();
    console.log("OAuth Response Status:", tokenResp.status);
    console.log("OAuth Response:", tokenText);

    if (!tokenResp.ok) {
      throw new Error(`OAuth failed (${tokenResp.status}): ${tokenText}`);
    }

    const tokenData = JSON.parse(tokenText);
    const access_token = tokenData.access_token;

    if (!access_token) {
      throw new Error(`No access token in response: ${tokenText}`);
    }

    // 2. Generate Password & Timestamp
    const date = new Date();
    const timestamp =
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);

    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // 3. Send STK Push Request
    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference:
        accountReference || `JiraniRide-${rideId || Date.now()}`,
      TransactionDesc: "JiraniRide Payment",
    };

    console.log("STK Push Request:", JSON.stringify(stkPayload));

    const stkResp = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });

    const data = await stkResp.json();
    console.log("STK Push Response:", JSON.stringify(data));

    // If we have a ride ID, store the checkout request ID for tracking
    if (rideId && data.CheckoutRequestID) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase.from("mpesa_transactions").insert({
          ride_id: rideId,
          checkout_request_id: data.CheckoutRequestID,
          merchant_request_id: data.MerchantRequestID,
          phone_number: formattedPhone,
          amount: Math.ceil(amount),
          status: "pending",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: data.ResponseCode === "0",
        message:
          data.CustomerMessage || data.ResponseDescription || data.errorMessage,
        checkoutRequestId: data.CheckoutRequestID,
        debug: {
          oauthSuccess: !!access_token,
          stkResponse: data,
          phoneUsed: formattedPhone,
          shortcodeUsed: shortcode,
        },
        ...data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("M-Pesa Push Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
