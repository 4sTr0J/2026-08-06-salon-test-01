-- Run this inside your Supabase SQL Editor (dashboard.supabase.com)
-- This adds customizable operating hours to the salon_owners table

ALTER TABLE public.salon_owners ADD COLUMN IF NOT EXISTS operating_start text DEFAULT '09:00';
ALTER TABLE public.salon_owners ADD COLUMN IF NOT EXISTS operating_end text DEFAULT '18:30';
