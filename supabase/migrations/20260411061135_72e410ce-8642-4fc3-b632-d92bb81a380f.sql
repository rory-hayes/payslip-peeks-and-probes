ALTER TABLE public.profiles ADD COLUMN annual_salary numeric NULL;
ALTER TABLE public.profiles ADD COLUMN currency text NULL DEFAULT 'GBP';