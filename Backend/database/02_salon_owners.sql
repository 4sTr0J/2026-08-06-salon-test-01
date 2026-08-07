-- ============================================================
-- 2. SALON OWNERS TABLE
-- ============================================================

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
    salon_image text,
    is_approved boolean DEFAULT false,
    operating_start text DEFAULT '09:00',
    operating_end text DEFAULT '18:30',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salon_owners ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS salon_owners_set_updated_at ON public.salon_owners;
CREATE TRIGGER salon_owners_set_updated_at
BEFORE UPDATE ON public.salon_owners
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Policies
DROP POLICY IF EXISTS "Owners can view own profile" ON public.salon_owners;
CREATE POLICY "Owners can view own profile" ON public.salon_owners FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Owners can insert own profile" ON public.salon_owners;
CREATE POLICY "Owners can insert own profile" ON public.salon_owners FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Owners can update own profile" ON public.salon_owners;
CREATE POLICY "Owners can update own profile" ON public.salon_owners FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public can view approved salon profiles" ON public.salon_owners;
CREATE POLICY "Public can view approved salon profiles" ON public.salon_owners FOR SELECT USING (is_approved = true);
