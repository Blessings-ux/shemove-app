// Simulate M-Pesa STK Push
// In production, this would call a Supabase Edge Function
export const mpesaService = {
  initiatePayment: async ({ phoneNumber, amount, accountReference }) => {
    console.log(
      `Initiating M-Pesa payment of KES ${amount} to ${phoneNumber} for ${accountReference}`
    );

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate success (90% chance)
    if (Math.random() > 0.1) {
      return { success: true, message: "Request accepted for processing" };
    } else {
      throw new Error("Failed to initiate M-Pesa transaction");
    }
  },
};
