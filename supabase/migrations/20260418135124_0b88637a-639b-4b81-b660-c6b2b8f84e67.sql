-- Restrict writes on legacy billing_subscriptions to service role only.
-- End users must never insert/update billing rows directly — only webhooks should.

CREATE POLICY "Service role can insert billing subscriptions"
ON public.billing_subscriptions
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update billing subscriptions"
ON public.billing_subscriptions
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');