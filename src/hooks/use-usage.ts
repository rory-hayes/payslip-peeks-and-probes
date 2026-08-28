import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from './use-subscription';

// Mirrors the server-owned caps in the latest payslip-check quota migration.
// The server remains authoritative.
export const FREE_AUTOMATIC_CHECKS_LIFETIME = 2;
export const PAID_UPLOADS_PER_MONTH = 6;
export const PAID_DRAFTS_PER_MONTH = 12;

export function automaticCheckLimit(isPremium: boolean, freeLimit: number): number {
  return isPremium ? PAID_UPLOADS_PER_MONTH : freeLimit;
}

export function payrollMessageDraftLimit(isPremium: boolean, freeLimit: number): number {
  return isPremium ? PAID_DRAFTS_PER_MONTH : freeLimit;
}

export interface Usage {
  automaticChecksLifetime: number;
  automaticChecksThisMonth: number;
  draftsThisMonth: number;
}

// Paid automatic checks and all draft allowances use the Ireland calendar
// month. Free automatic checks are counted across the account's lifetime.
// Keep monthly browser display/pre-flight on the server's Dublin boundary.
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
      const [lifetimeFreeUploadResult, monthlyUploadResult, draftResult] = await Promise.all([
        supabase
          .from('payslip_check_reservations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('tier_at_reservation', 'free'),
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

      if (lifetimeFreeUploadResult.error || monthlyUploadResult.error || draftResult.error) {
        throw lifetimeFreeUploadResult.error ?? monthlyUploadResult.error ?? draftResult.error;
      }

      return {
        automaticChecksLifetime: lifetimeFreeUploadResult.count ?? 0,
        automaticChecksThisMonth: monthlyUploadResult.count ?? 0,
        draftsThisMonth: draftResult.data?.filter((draft) => dublinMonthPeriod(draft.created_at) === period).length ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const usage = query.data ?? { automaticChecksLifetime: 0, automaticChecksThisMonth: 0, draftsThisMonth: 0 };
  // Usage and entitlement data are cost-control inputs. Do not present an
  // optimistic zero-usage free tier while either query is still loading or
  // has failed; the server remains authoritative either way.
  const accessReady = Boolean(user) && query.isSuccess && subscriptionQuery.isSuccess;
  const accessError = Boolean(user) && (query.isError || subscriptionQuery.isError);
  const accessPending = Boolean(user) && !accessReady && !accessError;

  const uploadLimit = automaticCheckLimit(subscription.isPremium, limits.automatic_checks_lifetime);
  const draftLimit = payrollMessageDraftLimit(subscription.isPremium, limits.drafts_per_month);
  const automaticChecksUsed = subscription.isPremium
    ? usage.automaticChecksThisMonth
    : usage.automaticChecksLifetime;
  const uploadQuotaScope = subscription.isPremium ? 'month' as const : 'lifetime' as const;
  const canUpload = accessReady && automaticChecksUsed < uploadLimit;
  const canDraft = accessReady && usage.draftsThisMonth < draftLimit;

  const uploadsRemaining = Math.max(0, uploadLimit - automaticChecksUsed);
  const draftsRemaining = Math.max(0, draftLimit - usage.draftsThisMonth);

  return {
    ...query,
    usage,
    accessReady,
    accessPending,
    accessError,
    automaticChecksUsed,
    canUpload,
    canDraft,
    uploadsRemaining,
    uploadLimit,
    uploadQuotaScope,
    draftsRemaining,
    draftLimit,
    isPremium: subscription.isPremium,
    limits,
    refetchAccess: async () => {
      await Promise.all([query.refetch(), subscriptionQuery.refetch()]);
    },
  };
}
