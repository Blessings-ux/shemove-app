# M-Pesa Integration Documentation

## Overview
JiraniRide integrates with Safaricom's M-Pesa to facilitate cashless payments for rides. The system primarily uses the **STK Push (Lipa na M-Pesa Online)** API to prompt users for payment immediately after a ride is completed or booked.

## Architecture

1.  **Client-Side (React)**: 
    - Takes the user's phone number.
    - Initiates a payment request via Supabase Edge Functions.
2.  **Server-Side (Supabase Edge Function)**:
    - `mpesa-push`: Authenticates with Safaricom and sends the STK Push request.
    - `mpesa-callback`: Receives the asynchronous confirmation from Safaricom.
3.  **Database**:
    - Stores transaction logs and updates ride payment status.

## Key Components

### 1. Payment Initiation (`mpesa-push`)
- **Trigger**: User clicks "Pay via M-Pesa".
- **Action**: 
    - Calls the edge function `mpesa-push`.
    - Generates a timestamp and password using the Business Shortcode and Passkey.
    - Sends a POST request to Safaricom's `/mpesa/stkpush/v1/processrequest`.
- **Response**: Returns a `CheckoutRequestID` to the client for tracking.

### 2. Callback Handling (`mpesa-callback`)
- **Endpoint**: Exposed URL (set as `CallBackURL` in the STK Push request).
- **Logic**:
    - Receives JSON payload from Safaricom.
    - Verifies the `ResultCode` (0 = Success).
    - Updates the `rides` table to mark payment as `paid`.
    - Updates the `notifications` table to alert the user.

## Data Flow
1. **User Request** -> **Edge Function (Push)** -> **Safaricom**
2. **User Phone** shows STK Prompt -> **User Enters PIN**
3. **Safaricom** -> **Edge Function (Callback)** -> **Supabase Database** -> **Realtime Client Update**

## Environment Variables
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_PASSKEY`
- `MPESA_SHORTCODE`
- `MPESA_ENV` (sandbox/production)
