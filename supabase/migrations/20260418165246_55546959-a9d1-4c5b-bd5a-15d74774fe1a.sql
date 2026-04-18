ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_country_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_country_check
  CHECK (country = ANY (ARRAY['UK','Ireland','Germany','France','Netherlands','Spain','Italy','Belgium','Portugal']::text[]));