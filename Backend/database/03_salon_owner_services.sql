-- ============================================================
-- 3. SALON OWNER SERVICES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.salon_owner_services (
    id          uuid        primary key default gen_random_uuid(),
    owner_id    uuid        references public.salon_owners(id) on delete cascade,
    name        text        not null,
    price       numeric     not null,
    duration    integer     not null,                       -- stored in minutes
    category    text        not null default 'General',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Enable RLS
ALTER TABLE public.salon_owner_services ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS salon_services_set_updated_at ON public.salon_owner_services;
CREATE TRIGGER salon_services_set_updated_at
BEFORE UPDATE ON public.salon_owner_services
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Policies
DROP POLICY IF EXISTS "Owners can manage their own services" ON public.salon_owner_services;
CREATE POLICY "Owners can manage their own services" 
  ON public.salon_owner_services
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Anyone can view salon services" ON public.salon_owner_services;
CREATE POLICY "Anyone can view salon services"
  ON public.salon_owner_services
  FOR SELECT
  USING (true);
