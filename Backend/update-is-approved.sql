-- Create a dedicated salon_owners table for Salon Owner registrations
CREATE TABLE IF NOT EXISTS public.salon_owners (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text NOT NULL UNIQUE,
    phone text,
    role text NOT NULL DEFAULT 'owner',
    salon_name text NOT NULL,
    salon_reg_id text NOT NULL,
    salon_address text NOT NULL,
    salon_website text,
    is_approved boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for the new table
ALTER TABLE public.salon_owners ENABLE ROW LEVEL SECURITY;

-- Allow owners to read/write their own registration profile
CREATE POLICY "Owners can view own profile" ON public.salon_owners FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Owners can insert own profile" ON public.salon_owners FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Owners can update own profile" ON public.salon_owners FOR UPDATE USING (auth.uid() = id);

