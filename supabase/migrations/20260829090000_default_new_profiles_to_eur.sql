-- Ireland is the launch default. A customer who explicitly selects the UK in
-- onboarding is still saved as GBP by the application.
ALTER TABLE public.profiles
  ALTER COLUMN currency SET DEFAULT 'EUR';
