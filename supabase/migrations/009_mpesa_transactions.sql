-- M-PESA PAYMENT STATUS TRACKING
-- Run this in Supabase SQL Editor

-- 1. Create mpesa_transactions table if not exists
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  checkout_request_id text UNIQUE NOT NULL,
  merchant_request_id text,
  phone_number text NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  mpesa_receipt text,
  result_code text,
  result_desc text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
DROP POLICY IF EXISTS "mpesa_transactions_select" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "mpesa_transactions_insert" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "mpesa_transactions_update" ON public.mpesa_transactions;

CREATE POLICY "mpesa_transactions_select" ON public.mpesa_transactions FOR SELECT USING (true);
CREATE POLICY "mpesa_transactions_insert" ON public.mpesa_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "mpesa_transactions_update" ON public.mpesa_transactions FOR UPDATE USING (true);

-- 4. Create the check_mpesa_payment function
CREATE OR REPLACE FUNCTION public.check_mpesa_payment(p_checkout_request_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  transaction_record RECORD;
BEGIN
  SELECT 
    id,
    status,
    mpesa_receipt,
    amount,
    result_code,
    result_desc
  INTO transaction_record
  FROM public.mpesa_transactions
  WHERE checkout_request_id = p_checkout_request_id;
  
  IF transaction_record IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'status', 'not_found'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'found', true,
    'status', transaction_record.status,
    'receipt', transaction_record.mpesa_receipt,
    'amount', transaction_record.amount,
    'result_code', transaction_record.result_code,
    'result_desc', transaction_record.result_desc
  );
END;
$$;

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout ON public.mpesa_transactions(checkout_request_id);

-- Done!
SELECT 'M-Pesa payment tracking setup complete!' as status;
