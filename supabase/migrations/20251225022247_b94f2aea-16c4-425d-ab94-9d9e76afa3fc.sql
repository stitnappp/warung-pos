-- Fix: Add RLS policy for users to manage their own notification settings
-- This prevents employees from accessing other users' contact information

CREATE POLICY "Users can view their own notification settings"
ON public.notification_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
ON public.notification_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
ON public.notification_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification settings"
ON public.notification_settings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);