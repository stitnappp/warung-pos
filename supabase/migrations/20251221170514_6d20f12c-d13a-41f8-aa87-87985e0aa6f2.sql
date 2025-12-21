-- Create accounting_entries table for daily accounting records
CREATE TABLE public.accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL, -- 'income', 'daily_summary'
  description TEXT NOT NULL,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL DEFAULT 0,
  reference_id UUID, -- Can reference order_id or daily_report_id
  reference_type TEXT, -- 'order', 'daily_report'
  payment_method TEXT, -- 'cash', 'transfer', 'qris'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage accounting entries"
ON public.accounting_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view accounting entries"
ON public.accounting_entries
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_accounting_entries_updated_at
BEFORE UPDATE ON public.accounting_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_accounting_entries_date ON public.accounting_entries(entry_date);
CREATE INDEX idx_accounting_entries_type ON public.accounting_entries(entry_type);