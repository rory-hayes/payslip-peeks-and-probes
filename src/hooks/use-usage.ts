import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from './use-subscription';

export interface Usage {
  automaticChecksThisMonth: number;
  draftsThisMonth: number;
}

// The server reserves the automatic-check allowance by the Ireland calendar
// month. Keep the browser display/pre-flight on the same boundary rather than
// using a person's device timezone or the old browser-created-at heuristic.
export function dublinMonthPeriod(value: Date | string): string {
  const now = typeof value === 'string' ? new Date(value) : value;
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid date for monthly usage');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('Unable to determine the Ireland usage month');
  return `${year}-${month}-01`;
}

export function currentDublinPeriod(now = new Date()): string {
  return dublinMonthPeriod(now);
}

export function useUsage() {
  const { user } = useAuth();
  const subscriptionQuery = useSubscription();
  const { subscription, limits } = subscriptionQuery;
  const period = currentDublinPeriod();

  const query = useQuery({
    queryKey: ['usage', user?.id, period],
    queryFn: async (): Promise<Usage> => {
      const [uploadResult, draftResult] = await Promise.all([
        supabase
          .from('payslip_check_reservations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('period', period),
        supabase
          .from('issue_drafts')
          .select('created_at')
          .eq('user_id', user!.id)
      ]);

      if (uploadResult.error || draftResult.error) {
        throw uploadResult.error ?? draftResult.error;
      }

      return {
        automaticChecksThisMonth: uploadResult.count ?? 0,
        draftsThisMonth: draftResult.data?.filter((draft) => dublinMonthPeriod(draft.created_at) === period).length ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const usage = query.data ?? { automaticChecksThisMonth: 0, draftsThisMonth: 0 };
  // Usage and entitlement data are cost-control inputs. Do not present an
  // optimistic zero-usage free tier while either query is still loading or
  // has failed; the server remains authoritative either way.
  const accessReady = Boolean(user) && query.isSuccess && subscriptionQuery.isSuccess;
  const accessError = Boolean(user) && (query.isError || subscriptionQuery.isError);
  const accessPending = Boolean(user) && !accessReady && !accessError;

  const canUpload = accessReady && (subscription.isPremium || usage.automaticChecksThisMonth < limits.uploads_per_month);
  const canDraft = accessReady && (subscription.isPremium || usage.draftsThisMonth < limits.drafts_per_month);

  const uploadsRemaining = subscription.isPremium
    ? Infinity
    : Math.max(0, limits.uploads_per_month - usage.automaticChecksThisMonth);
  const draftsRemaining = subscription.isPremium
    ? Infinity
    : Math.max(0, limits.drafts_per_month - usage.draftsThisMonth);

  return {
    ...query,
    usage,
    accessReady,
    accessPending,
    accessError,
    canUpload,
    canDraft,
    uploadsRemaining,
    draftsRemaining,
    isPremium: subscription.isPremium,
    limits,
    refetchAccess: async () => {
      await Promise.all([query.refetch(), subscriptionQuery.refetch()]);
    },
  };
}
