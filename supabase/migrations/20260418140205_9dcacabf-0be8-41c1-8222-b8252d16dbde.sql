-- Remove user DELETE policy on audit_events to preserve audit integrity.
-- Users should never be able to delete or modify their own audit trail.
DROP POLICY IF EXISTS "Users can delete own audit events" ON public.audit_events;