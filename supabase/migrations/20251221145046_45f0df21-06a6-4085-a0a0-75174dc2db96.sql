-- Add cashier_name column to orders table to store the cashier name at the time of transaction
ALTER TABLE public.orders ADD COLUMN cashier_name text;