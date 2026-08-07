-- ============================================================
-- 5. SALON REVIEWS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.salon_reviews (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id        uuid        NOT NULL REFERENCES public.salon_owners(id) ON DELETE CASCADE,
  appointment_id  uuid        REFERENCES public.appointments(id) ON DELETE SET NULL,
  customer_name   text        NOT NULL,
  customer_email  text        NOT NULL,
  rating          integer     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text     text        NOT NULL,
  sentiment       text        NOT NULL,                       -- 'Positive' | 'Negative' | 'Neutral'
  sentiment_score numeric     NOT NULL,                       -- Sentiment score e.g. -1.0 to 1.0 or 0 to 100
  pros            jsonb       DEFAULT '[]'::jsonb,            -- NLP extracted positive points
  cons            jsonb       DEFAULT '[]'::jsonb,            -- NLP extracted negative points
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexing for fast queries and aggregations
CREATE INDEX IF NOT EXISTS salon_reviews_salon_id_idx ON public.salon_reviews(salon_id);
CREATE INDEX IF NOT EXISTS salon_reviews_rating_idx ON public.salon_reviews(rating);

-- Enable RLS
ALTER TABLE public.salon_reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to reviews
DROP POLICY IF EXISTS "Reviews are publicly viewable" ON public.salon_reviews;
CREATE POLICY "Reviews are publicly viewable"
  ON public.salon_reviews
  FOR SELECT
  USING (true);
