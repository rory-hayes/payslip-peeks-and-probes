import type { AnomalyResult } from '@/lib/types';

export const ANOMALY_PRIORITY_LABELS: Record<AnomalyResult['severity'], string> = {
  high: 'High priority',
  medium: 'Worth checking',
  low: 'For awareness',
};

