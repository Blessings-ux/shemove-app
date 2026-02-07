# Daraja M-Pesa Integration - Troubleshooting Guide

## Current Error: "Wrong credentials"

### ✅ What's Working:
- OAuth authentication is **successful** (Consumer Key & Secret are correct)
- Edge Functions are deployed and responding
- Environment variables are set

### ❌ The Problem:
The error `"Wrong credentials"` despite successful OAuth means there's a **mismatch between your Shortcode and Passkey**.

## 🔍 Finding Your Correct Credentials

Go to your Daraja app and verify these exact values:

### Step 1: Log into Daraja Portal
1. Visit: https://developer.safaricom.co.ke/
2. Click **Login** → Go to **My Apps**
3. Select your app (the one with Consumer Key: `js441p2OR9Vw8rb...`)

### Step 2: Check Test Credentials Section
In your app, look for **"Test Credentials"** or **"Sandbox Credentials"**. You should see:

```
Business Short Code (Paybill/Till): [YOUR_SHORTCODE]
Lipa Na Mpesa Online Passkey: [YOUR_PASSKEY]
```

### ⚠️ Important: The Shortcode Matters!

The default sandbox shortcode is `174379`, but your specific app might have a different one. Common values:
- `174379` - Default sandbox paybill
- `601426` - Another common sandbox shortcode
- Your custom shortcode (check in your app's test credentials)

## 🛠️ How to Fix

### Option 1: Find Your Correct Shortcode

If your shortcode is **different from 174379**, update it:

```bash
# Replace XXXXXX with your actual shortcode from Daraja
supabase secrets set MPESA_SHORTCODE="XXXXXX"
```

### Option 2: Use the Sandbox Simulator (Easier for Testing)

Safaricom provides a simulator that doesn't require real credentials. If you just want to test the flow:

1. In Daraja portal, go to **APIs** → **Lipa Na M-Pesa Online**
2. Use the **"Test"** or **"Simulator"** section
3. Note the test credentials provided there

### Option 3: Verify Passkey Format

The passkey should be a **long base64-encoded string**. Verify yours matches the one in Daraja exactly (no extra spaces or line breaks).

Current passkey (first 50 chars): `Vs44Ug1LmdLofLdj0AGrbrqCTRZ98Ih/Xo5TMson+a61uR...`

## 🧪 Testing After Fixing

Once you update the shortcode, test again:

```bash
curl -X POST "https://chesujilpgxhapkeesle.supabase.co/functions/v1/mpesa-push" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZXN1amlscGd4aGFwa2Vlc2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDg3NjYsImV4cCI6MjA4MzI4NDc2Nn0.Zy8fdxd-Ri_mC6kQRkNLcp28fCLgpuhYu1vWr1lIHaI" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "254708374149", "amount": 1}'
```

**Success looks like:**
```json
{
  "success": true,
  "message": "Success. Request accepted for processing",
  "checkoutRequestId": "ws_CO_04022026..."
}
```

## 📝 Common Daraja Sandbox Issues

| Issue | Solution |
|-------|----------|
| "Wrong credentials" | Verify shortcode matches passkey |
| "Invalid Access Token" | Check Consumer Key/Secret |
| "Invalid Phone Number" | Use 254708374149 for sandbox |
| "Amount out of range" | Use 1-70000 KES |
| "Unable to lock subscriber" | Phone number already in use in another test |

## 🎯 Quick Shortcode Test

Try these common sandbox shortcodes one by one:

```bash
# Try shortcode 174379 (most common)
supabase secrets set MPESA_SHORTCODE="174379"

# Try shortcode 601426
supabase secrets set MPESA_SHORTCODE="601426"

# Try shortcode 600000 (some apps use this)
supabase secrets set MPESA_SHORTCODE="600000"
```

After each change, wait ~30 seconds and test the API call again.

## 🔗 Resources

- [Daraja API Documentation](https://developer.safaricom.co.ke/Documentation)
- [Common Error Codes](https://developer.safaricom.co.ke/APIs/CommonErrors)
- [Lipa Na M-Pesa Online Guide](https://developer.safaricom.co.ke/lipa-na-m-pesa-online)

---

**Next Step**: Check your Daraja app's Test Credentials section and verify the exact shortcode, then update it using the command above.
