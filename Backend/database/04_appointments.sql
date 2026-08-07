-- ============================================================
-- 4. APPOINTMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id            uuid        REFERENCES public.salon_owners(id) ON DELETE CASCADE,
  customer_name       text        NOT NULL,
  customer_email      text        NOT NULL,
  service_name        text        NOT NULL,
  appointment_date    text        NOT NULL,                     -- stored as 'YYYY-MM-DD' text
  appointment_time    text        NOT NULL,                     -- stored as 'HH:MM' text
  appointment_datetime timestamptz,                            -- full ISO datetime for scheduling
  reminder_time       timestamptz,                             -- 1 hour before appointment
  reminder_status     text        NOT NULL DEFAULT 'Pending',   -- Pending | Processing | Sent | Failed
  booking_status      text        NOT NULL DEFAULT 'Confirmed', -- Confirmed | Upcoming | Completed | Cancelled | Rescheduled
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Policies
DROP POLICY IF EXISTS "Customers can view own appointments" ON public.appointments;
CREATE POLICY "Customers can view own appointments"
  ON public.appointments
  FOR SELECT
  USING (auth.jwt() ->> 'email' = customer_email);

DROP POLICY IF EXISTS "Owners can view own salon appointments" ON public.appointments;
CREATE POLICY "Owners can view own salon appointments"
  ON public.appointments
  FOR SELECT
  USING (auth.uid() = salon_id);

DROP POLICY IF EXISTS "Owners can update own salon appointments" ON public.appointments;
CREATE POLICY "Owners can update own salon appointments"
  ON public.appointments
  FOR UPDATE
  USING (auth.uid() = salon_id);
