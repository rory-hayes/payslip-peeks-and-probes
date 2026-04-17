-- Defense-in-depth: enforce file size & MIME types at the storage layer
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['application/pdf','image/png','image/jpeg','image/webp']
WHERE id = 'payslips';