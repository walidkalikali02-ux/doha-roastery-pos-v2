-- Create transactions table with branch_name support
-- Migration: 20260409_create_transactions_table

CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  branch_name TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('CASH', 'CARD', 'MOBILE', 'SPLIT')),
  payment_breakdown JSONB,
  card_reference TEXT,
  user_id UUID,
  cashier_name TEXT,
  received_amount NUMERIC DEFAULT 0,
  change_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_returned BOOLEAN DEFAULT FALSE,
  return_id TEXT,
  customer_id UUID,
  customer_name TEXT
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transactions' AND policyname = 'Enable insert access for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert access for authenticated users" 
      ON public.transactions FOR INSERT 
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transactions' AND policyname = 'Enable read access for authenticated users'
  ) THEN
    CREATE POLICY "Enable read access for authenticated users" 
      ON public.transactions FOR SELECT 
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_location_id ON public.transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_name ON public.transactions(cashier_name);

-- Grant permissions
GRANT SELECT, INSERT ON public.transactions TO authenticated;
