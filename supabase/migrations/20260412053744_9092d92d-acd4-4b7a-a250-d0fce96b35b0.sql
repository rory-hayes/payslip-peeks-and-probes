
-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload own payslips" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own payslips" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own payslips" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own payslips" ON storage.objects;

-- Recreate with correct role targeting
CREATE POLICY "Users can upload own payslips"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payslips' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own payslips"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payslips' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own payslips"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payslips' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own payslips"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'payslips' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
