-- M-Pesa Payments Feature - Database Migration
-- Run this in Supabase SQL Editor

-- 1. Create mpesa_transactions table to track payment requests
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid REFERENCES rides(id) ON DELETE SET NULL,
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  phone_number text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  result_code integer,
  result_desc text,
  mpesa_receipt text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 2. Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_ride ON mpesa_transactions(ride_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status ON mpesa_transactions(status);

-- 3. Add payment columns to rides table if not exists
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_method text 
  CHECK (payment_method IN ('cash', 'mpesa', 'card'));
ALTER TABLE rides ADD COLUMN IF NOT EXISTS mpesa_receipt text;

-- 4. Enable RLS on mpesa_transactions
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- 5. Policies for mpesa_transactions

-- Users can view their own transactions (via ride ownership)
DROP POLICY IF EXISTS "Users can view own mpesa transactions" ON mpesa_transactions;
CREATE POLICY "Users can view own mpesa transactions"
ON mpesa_transactions FOR SELECT
USING (
  ride_id IN (
    SELECT id FROM rides WHERE passenger_id = auth.uid() OR driver_id = auth.uid()
  )
);

-- Admins can view all transactions
DROP POLICY IF EXISTS "Admins can view all mpesa transactions" ON mpesa_transactions;
CREATE POLICY "Admins can view all mpesa transactions"
ON mpesa_transactions FOR SELECT
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- Service role can insert/update (for Edge Functions)
-- Note: Edge Functions use service_role key which bypasses RLS

-- 6. Function to check payment status
CREATE OR REPLACE FUNCTION check_mpesa_payment(p_checkout_request_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction mpesa_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_transaction
  FROM mpesa_transactions
  WHERE checkout_request_id = p_checkout_request_id;
  
  IF v_transaction IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;
  
  RETURN json_build_object(
    'found', true,
    'status', v_transaction.status,
    'receipt', v_transaction.mpesa_receipt,
    'amount', v_transaction.amount
  );
END;
$$;
