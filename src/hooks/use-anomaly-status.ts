import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AnomalyStatus } from '@/lib/types';

export function useUpdateAnomalyStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AnomalyStatus }) => {
      const { error } = await supabase
        .from('anomaly_results')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ status }) => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      const labels: Record<AnomalyStatus, string> = {
        new: 'Reopened',
        reviewed: 'Marked as reviewed',
        raised: 'Marked as raised with payroll',
        resolved: 'Marked as resolved',
      };
      toast({ title: labels[status] });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not update status', description: err.message, variant: 'destructive' });
    },
  });
}
