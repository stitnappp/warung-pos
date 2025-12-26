-- Create app_settings table for storing Midtrans and other configurations
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Only admins can manage app settings"
ON public.app_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create policy for authenticated users to read settings
CREATE POLICY "Authenticated users can read app settings"
ON public.app_settings
FOR SELECT
USING (auth.role() = 'authenticated');

-- Insert default Midtrans settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('midtrans_merchant_id', '', 'Midtrans Merchant ID'),
  ('midtrans_server_key', '', 'Midtrans Server Key'),
  ('midtrans_client_key', '', 'Midtrans Client Key'),
  ('midtrans_environment', 'sandbox', 'Midtrans Environment (sandbox/production)')
ON CONFLICT (key) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();