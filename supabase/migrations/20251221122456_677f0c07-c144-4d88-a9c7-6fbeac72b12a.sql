-- Add DELETE policies for order_items table
CREATE POLICY "Admins can delete order items"
ON public.order_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policies for orders table
CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));