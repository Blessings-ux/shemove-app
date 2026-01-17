// supabase/functions/mpesa-callback/index.ts
// M-Pesa Callback Handler for payment confirmations
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa Callback Received:", JSON.stringify(body));

    // Extract the callback data
    const stkCallback = body?.Body?.stkCallback;

    if (!stkCallback) {
      throw new Error("Invalid callback format");
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stkCallback;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse callback metadata if successful
    let transactionData: Record<string, any> = {};

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        switch (item.Name) {
          case "MpesaReceiptNumber":
            transactionData.mpesa_receipt = item.Value;
            break;
          case "TransactionDate":
            transactionData.transaction_date = item.Value;
            break;
          case "Amount":
            transactionData.confirmed_amount = item.Value;
            break;
          case "PhoneNumber":
            transactionData.confirmed_phone = item.Value;
            break;
        }
      }
    }

    // Update mpesa_transactions table
    const { data: transaction, error: txError } = await supabase
      .from("mpesa_transactions")
      .update({
        status: ResultCode === 0 ? "completed" : "failed",
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt: transactionData.mpesa_receipt,
        completed_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", CheckoutRequestID)
      .select("ride_id")
      .single();

    if (txError) {
      console.error("Error updating transaction:", txError);
    }

    // If payment was successful and we have a ride_id, update the ride
    if (ResultCode === 0 && transaction?.ride_id) {
      const { error: rideError } = await supabase
        .from("rides")
        .update({
          payment_status: "paid",
          payment_method: "mpesa",
          mpesa_receipt: transactionData.mpesa_receipt,
        })
        .eq("id", transaction.ride_id);

      if (rideError) {
        console.error("Error updating ride:", rideError);
      }

      // Send notification to passenger
      const { data: ride } = await supabase
        .from("rides")
        .select("passenger_id, fare")
        .eq("id", transaction.ride_id)
        .single();

      if (ride?.passenger_id) {
        await supabase.from("notifications").insert({
          user_id: ride.passenger_id,
          type: "payment_success",
          title: "Payment Received! ✅",
          message: `Your M-Pesa payment of KES ${ride.fare} was successful. Receipt: ${transactionData.mpesa_receipt}`,
          data: {
            ride_id: transaction.ride_id,
            receipt: transactionData.mpesa_receipt,
          },
        });
      }
    } else if (ResultCode !== 0 && transaction?.ride_id) {
      // Payment failed - notify passenger
      const { data: ride } = await supabase
        .from("rides")
        .select("passenger_id")
        .eq("id", transaction.ride_id)
        .single();

      if (ride?.passenger_id) {
        await supabase.from("notifications").insert({
          user_id: ride.passenger_id,
          type: "payment_failed",
          title: "Payment Failed ❌",
          message: `M-Pesa payment was not completed: ${ResultDesc}`,
          data: { ride_id: transaction.ride_id },
        });
      }
    }

    // Return success to Safaricom (they require this)
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Callback received successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("M-Pesa Callback Error:", error);
    // Still return 200 to Safaricom to prevent retries
    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Processed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
