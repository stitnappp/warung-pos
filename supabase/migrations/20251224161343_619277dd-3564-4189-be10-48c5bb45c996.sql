-- Create restaurant settings table
CREATE TABLE public.restaurant_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_name text NOT NULL DEFAULT 'RM.MINANG MAIMBAOE',
  address_line1 text DEFAULT 'Jln. Gatot Subroto no.10',
  address_line2 text DEFAULT 'Depan Balai Desa Losari Kidul',
  address_line3 text DEFAULT 'Losari, Cirebon 45192',
  whatsapp_number text DEFAULT '',
  instagram_handle text DEFAULT '',
  footer_message text DEFAULT 'Terima Kasih!',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view restaurant settings"
ON public.restaurant_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage restaurant settings"
ON public.restaurant_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.restaurant_settings (id) VALUES (gen_random_uuid());

-- Create trigger for updated_at
CREATE TRIGGER update_restaurant_settings_updated_at
BEFORE UPDATE ON public.restaurant_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();