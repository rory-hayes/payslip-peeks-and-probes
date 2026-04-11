
ALTER TABLE public.profiles
ADD COLUMN pension_percent numeric DEFAULT NULL,
ADD COLUMN student_loan_plan text DEFAULT NULL;
