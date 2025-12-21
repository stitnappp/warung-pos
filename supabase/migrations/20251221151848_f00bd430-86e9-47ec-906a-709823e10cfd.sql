-- Add telegram_chat_id column to notification_settings
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;