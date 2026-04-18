ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_region TEXT,
  ADD COLUMN IF NOT EXISTS filing_status TEXT;