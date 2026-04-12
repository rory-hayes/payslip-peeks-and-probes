import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from './use-subscription';

export interface Usage {
  uploadsThisMonth: number;
  draftsThisMonth: number;
}

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export function useUsage() {
  const { user } = useAuth();
  const { subscription, limits } = useSubscription();

  const query = useQuery({
    queryKey: ['usage', user?.id],
    queryFn: async (): Promise<Usage> => {
      const since = startOfMonth();

      const [{ count: uploadCount }, { count: draftCount }] = await Promise.all([
        supabase
          .from('payslips')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .gte('created_at', since),
        supabase
          .from('issue_drafts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .gte('created_at', since),
      ]);

      return {
        uploadsThisMonth: uploadCount ?? 0,
        draftsThisMonth: draftCount ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const usage = query.data ?? { uploadsThisMonth: 0, draftsThisMonth: 0 };

  const canUpload = subscription.isPremium || usage.uploadsThisMonth < limits.uploads_per_month;
  const canDraft = subscription.isPremium || usage.draftsThisMonth < limits.drafts_per_month;

  const uploadsRemaining = subscription.isPremium
    ? Infinity
    : Math.max(0, limits.uploads_per_month - usage.uploadsThisMonth);
  const draftsRemaining = subscription.isPremium
    ? Infinity
    : Math.max(0, limits.drafts_per_month - usage.draftsThisMonth);

  return {
    ...query,
    usage,
    canUpload,
    canDraft,
    uploadsRemaining,
    draftsRemaining,
    isPremium: subscription.isPremium,
    limits,
  };
}
