-- Fix: Allow cashiers to update their own profile
-- Run this in Supabase SQL Editor to fix the existing database

CREATE POLICY IF NOT EXISTS "cashier_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (
    CASE
      WHEN public.current_user_is_cashier() THEN id = auth.uid()
      ELSE true
    END
  )
  WITH CHECK (
    CASE
      WHEN public.current_user_is_cashier() THEN id = auth.uid()
      ELSE true
    END
  );