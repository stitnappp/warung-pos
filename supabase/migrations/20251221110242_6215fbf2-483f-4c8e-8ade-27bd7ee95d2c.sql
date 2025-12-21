-- Create payment_notifications table for storing incoming payment notifications
CREATE TABLE public.payment_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  transaction_id TEXT,
  payment_type TEXT NOT NULL,
  transaction_status TEXT NOT NULL,
  gross_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'IDR',
  transaction_time TIMESTAMP WITH TIME ZONE,
  raw_payload JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read notifications
CREATE POLICY "Authenticated users can read payment notifications"
ON public.payment_notifications
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to update read status
CREATE POLICY "Authenticated users can update payment notifications"
ON public.payment_notifications
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Enable realtime for payment notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_notifications;