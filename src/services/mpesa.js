// M-Pesa Payment Service
// Handles STK Push requests and payment status checking
import { supabase } from "./supabase";

/**
 * Initiate M-Pesa STK Push payment
 * @param {string} phoneNumber - Phone number (will be formatted automatically)
 * @param {number} amount - Amount in KES
 * @param {string} rideId - Optional ride ID to associate payment with
 * @returns {Promise<{success: boolean, message: string, checkoutRequestId?: string}>}
 */
export const initiateMpesaPayment = async (
  phoneNumber,
  amount,
  rideId = null,
) => {
  try {
    // Check if user is authenticated first
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      console.error("M-Pesa: User not authenticated", authError);
      return {
        success: false,
        message: "Please log in again to make a payment",
        authRequired: true,
      };
    }

    // Format phone number to 254 format
    let formattedPhone = phoneNumber.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    console.log("M-Pesa: Calling Edge Function with auth token...");

    const { data, error } = await supabase.functions.invoke("mpesa-push", {
      body: {
        phoneNumber: formattedPhone,
        amount: Math.ceil(amount),
        rideId: rideId,
        accountReference: rideId
          ? `Ride-${rideId.slice(0, 8)}`
          : `JiraniRide-${Date.now()}`,
      },
    });

    if (error) {
      console.error("M-Pesa function error:", error);

      // Check if it's a 401 auth error
      if (
        error.message?.includes("401") ||
        error.message?.includes("Unauthorized")
      ) {
        // Try to refresh the session
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          return {
            success: false,
            message: "Session expired. Please log in again.",
            authRequired: true,
          };
        }
        // Retry the request on successful refresh
        return initiateMpesaPayment(phoneNumber, amount, rideId);
      }

      return {
        success: false,
        message: error.message || "Failed to initiate payment",
      };
    }

    return {
      success: data?.success || data?.ResponseCode === "0",
      message:
        data?.message ||
        data?.CustomerMessage ||
        "Check your phone for M-Pesa prompt",
      checkoutRequestId: data?.checkoutRequestId || data?.CheckoutRequestID,
    };
  } catch (err) {
    console.error("M-Pesa payment error:", err);
    return {
      success: false,
      message: "Payment service unavailable. Please try again.",
    };
  }
};

/**
 * Check the status of an M-Pesa payment
 * @param {string} checkoutRequestId - The checkout request ID from STK push
 * @returns {Promise<{status: string, receipt?: string, amount?: number}>}
 */
export const checkPaymentStatus = async (checkoutRequestId) => {
  try {
    const { data, error } = await supabase.rpc("check_mpesa_payment", {
      p_checkout_request_id: checkoutRequestId,
    });

    if (error) {
      console.error("Payment status check error:", error);
      return { status: "unknown" };
    }

    if (!data?.found) {
      return { status: "not_found" };
    }

    return {
      status: data.status,
      receipt: data.receipt,
      amount: data.amount,
    };
  } catch (err) {
    console.error("Payment status error:", err);
    return { status: "error" };
  }
};

/**
 * Poll for payment completion
 * Useful for showing loading state while waiting for user to enter PIN
 * @param {string} checkoutRequestId - The checkout request ID
 * @param {number} maxAttempts - Maximum polling attempts (default 30 = ~1 minute)
 * @param {number} intervalMs - Polling interval in ms (default 2000 = 2 seconds)
 * @returns {Promise<{success: boolean, status: string, receipt?: string}>}
 */
export const pollPaymentStatus = async (
  checkoutRequestId,
  maxAttempts = 30,
  intervalMs = 2000,
) => {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const result = await checkPaymentStatus(checkoutRequestId);

    if (result.status === "completed") {
      return { success: true, status: "completed", receipt: result.receipt };
    }

    if (result.status === "failed" || result.status === "cancelled") {
      return { success: false, status: result.status };
    }

    // Still pending, continue polling
  }

  // Timeout
  return { success: false, status: "timeout" };
};
