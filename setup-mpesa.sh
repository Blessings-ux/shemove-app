#!/bin/bash
# M-Pesa Setup Script for JiraniRide
# This script helps you configure M-Pesa environment variables in Supabase

echo "🚀 JiraniRide M-Pesa Setup"
echo "=========================="
echo ""
echo "This script will help you configure M-Pesa credentials in Supabase."
echo "You can get these credentials from: https://developer.safaricom.co.ke/"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   brew install supabase/tap/supabase"
    exit 1
fi

echo "📝 Please enter your M-Pesa credentials:"
echo ""

read -p "Consumer Key: " CONSUMER_KEY
read -p "Consumer Secret: " CONSUMER_SECRET
read -p "Passkey: " PASSKEY
read -p "Shortcode (default: 174379 for sandbox): " SHORTCODE
SHORTCODE=${SHORTCODE:-174379}

read -p "Environment (sandbox/production, default: sandbox): " ENVIRONMENT
ENVIRONMENT=${ENVIRONMENT:-sandbox}

CALLBACK_URL="https://chesujilpgxhapkeesle.supabase.co/functions/v1/mpesa-callback"

echo ""
echo "🔐 Setting secrets in Supabase..."

supabase secrets set MPESA_CONSUMER_KEY="$CONSUMER_KEY"
supabase secrets set MPESA_CONSUMER_SECRET="$CONSUMER_SECRET"
supabase secrets set MPESA_PASSKEY="$PASSKEY"
supabase secrets set MPESA_SHORTCODE="$SHORTCODE"
supabase secrets set MPESA_ENVIRONMENT="$ENVIRONMENT"
supabase secrets set MPESA_CALLBACK_URL="$CALLBACK_URL"

echo ""
echo "✅ M-Pesa credentials configured successfully!"
echo ""
echo "📋 Summary:"
echo "   - Shortcode: $SHORTCODE"
echo "   - Environment: $ENVIRONMENT"
echo "   - Callback URL: $CALLBACK_URL"
echo ""
echo "🧪 To test your integration:"
echo "   1. Use test phone number: 254708374149 (Sandbox)"
echo "   2. Amount: Any amount between 1-70000 KES"
echo "   3. PIN: 1234 (Sandbox default)"
echo ""
echo "🔗 Next steps:"
echo "   1. Restart your Edge Functions (they auto-restart after secret changes)"
echo "   2. Test the payment flow in your app"
echo "   3. Check logs: supabase functions logs mpesa-push"
echo ""
