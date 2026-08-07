-- ============================================================
-- 1. USERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  role text NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.users;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Policies
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.users;
CREATE POLICY "Profiles are viewable by owner" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles can be inserted by owner" ON public.users;
CREATE POLICY "Profiles can be inserted by owner" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles can be updated by owner" ON public.users;
CREATE POLICY "Profiles can be updated by owner" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
