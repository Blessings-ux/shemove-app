# M-Pesa Setup Guide for JiraniRide

## 🎯 Current Status
✅ M-Pesa Edge Functions deployed successfully:
- `mpesa-push` - Initiates STK Push payments
- `mpesa-callback` - Handles payment confirmations

❌ **Environment variables NOT configured yet** - This is why you're getting the error!

## 🚨 The Error You're Seeing

```
POST https://chesujilpgxhapkeesle.supabase.co/functions/v1/mpesa-push net::ERR_FAILED
```

**Cause**: The Edge Function exists but requires M-Pesa credentials to work properly.

## 🔧 Quick Fix - Complete Setup

### Option 1: Using the Setup Script (Recommended)

Run the setup script I created:

```bash
./setup-mpesa.sh
```

It will prompt you for your M-Pesa credentials and configure everything automatically.

### Option 2: Manual Setup via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/chesujilpgxhapkeesle/settings/functions
2. Click on "Edge Functions" → "Environment Variables"
3. Add these secrets:
   - `MPESA_CONSUMER_KEY` - Your app consumer key
   - `MPESA_CONSUMER_SECRET` - Your app consumer secret  
   - `MPESA_PASSKEY` - Your app passkey
   - `MPESA_SHORTCODE` - Your paybill/till number (174379 for sandbox)
   - `MPESA_ENVIRONMENT` - `sandbox` or `production`
   - `MPESA_CALLBACK_URL` - `https://chesujilpgxhapkeesle.supabase.co/functions/v1/mpesa-callback`

### Option 3: Manual Setup via CLI

```bash
supabase secrets set MPESA_CONSUMER_KEY=your_key_here
supabase secrets set MPESA_CONSUMER_SECRET=your_secret_here
supabase secrets set MPESA_PASSKEY=your_passkey_here
supabase secrets set MPESA_SHORTCODE=174379
supabase secrets set MPESA_ENVIRONMENT=sandbox
supabase secrets set MPESA_CALLBACK_URL=https://chesujilpgxhapkeesle.supabase.co/functions/v1/mpesa-callback
```

## 🔑 Getting M-Pesa Credentials

### For Testing (Sandbox)

1. **Visit**: https://developer.safaricom.co.ke/
2. **Sign up** for a developer account
3. **Create a new app**:
   - Go to "My Apps" → "Create New App"
   - Select "Lipa Na M-Pesa Online" API
   - Note down your:
     - Consumer Key
     - Consumer Secret
     - Passkey (from test credentials section)

### Sandbox Test Credentials

- **Test Phone Number**: 254708374149
- **Test PIN**: 1234
- **Shortcode**: 174379
- **Amount**: Any value between 1-70000 KES

### For Production

You'll need:
1. A registered M-Pesa Paybill or Till number
2. Production credentials from Safaricom
3. To update `MPESA_ENVIRONMENT` to `production`

## ✅ Verification

After setting up credentials, test the payment flow:

1. **Open your app** (already running on localhost)
2. **Try to initiate a payment**
3. **Check the function logs**:
   ```bash
   supabase functions logs mpesa-push
   ```

## 🐛 Troubleshooting

### Still getting errors?

1. **Check if secrets are set**:
   ```bash
   supabase secrets list
   ```

2. **View function logs**:
   ```bash
   supabase functions logs mpesa-push --follow
   ```

3. **Redeploy the function** (if needed):
   ```bash
   supabase functions deploy mpesa-push
   ```

### Common Issues

| Error | Solution |
|-------|----------|
| `M-Pesa credentials not configured` | Set all environment variables |
| `OAuth failed` | Check Consumer Key/Secret are correct |
| `Invalid Access Token` | Verify you're using the right environment (sandbox vs production) |
| `Invalid Shortcode` | Ensure shortcode matches your app type |

## 📚 Resources

- [Safaricom Daraja API Documentation](https://developer.safaricom.co.ke/Documentation)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [JiraniRide M-Pesa Integration Docs](./Docs/M-Pesa_Integration.md)

## 🎉 Next Steps

Once configured:
1. ✅ Test with sandbox credentials
2. ✅ Verify callback handling works
3. ✅ Switch to production when ready
4. ✅ Add error handling in your UI

---

**Need help?** Check the function logs or contact Safaricom support for credential issues.
