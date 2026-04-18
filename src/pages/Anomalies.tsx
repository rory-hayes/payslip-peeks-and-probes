import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import AnomalyExplanation from '@/components/AnomalyExplanation';
import { useAnomalies } from '@/hooks/use-payslip-data';
import { useUpdateAnomalyStatus } from '@/hooks/use-anomaly-status';
import { formatDate } from '@/lib/date-utils';
import type { AnomalyStatus } from '@/lib/types';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Eye, MessageSquare, RotateCcw, Send } from 'lucide-react';

const statusLabels: Record<AnomalyStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  raised: 'Raised with payroll',
  resolved: 'Resolved',
};

const Anomalies = () => {
  const [filter, setFilter] = useState<AnomalyStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data: realAnomalies, isLoading } = useAnomalies();

  const all = realAnomalies || [];
  const filtered = filter === 'all' ? all : all.filter((a) => a.status === filter);
  const highCount = all.filter((a) => a.severity === 'high' && a.status === 'new').length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anomalies</h1>
          <p className="text-sm text-muted-foreground">{all.length} flagged items across your payslips</p>
        </div>

        {highCount > 0 && (
          <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{highCount} high-severity item{highCount !== 1 && 's'} need your attention</p>
                <p className="text-xs text-muted-foreground">These may indicate payroll errors worth raising with your employer.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap">
          {(['all', 'new', 'reviewed', 'raised', 'resolved'] as const).map((s) => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)} className="capitalize text-xs">
              {s === 'all' ? `All (${all.length})` : `${statusLabels[s]} (${all.filter((a) => a.status === s).length})`}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm"><CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle className="h-12 w-12 text-success/40" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No anomalies here</h3>
              <p className="mt-2 text-sm text-muted-foreground">Nothing flagged in this category.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((anomaly) => (
              <Card key={anomaly.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      anomaly.severity === 'high' ? 'bg-destructive/10 text-destructive' :
                      anomaly.severity === 'medium' ? 'bg-anomaly/10 text-anomaly' :
                      'bg-warning/10 text-warning'
                    }`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{anomaly.title}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`text-xs capitalize ${
                            anomaly.severity === 'high' ? 'border-destructive text-destructive' :
                            anomaly.severity === 'medium' ? 'border-anomaly text-anomaly' :
                            'border-warning text-warning'
                          }`}>{anomaly.severity}</Badge>
                          <Badge variant="secondary" className="text-xs capitalize">{statusLabels[anomaly.status]}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{anomaly.employer_name} · {formatDate(anomaly.payslip_date)}</p>
                      
                      {!expanded[anomaly.id] ? (
                        <div className="mt-2">
                          <AnomalyExplanation description={anomaly.description} suggestedAction={anomaly.suggested_action} compact />
                        </div>
                      ) : (
                        <div className="mt-3">
                          <AnomalyExplanation description={anomaly.description} suggestedAction={anomaly.suggested_action} />
                        </div>
                      )}
                      
                      <div className="mt-3 flex gap-2">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setExpanded(prev => ({ ...prev, [anomaly.id]: !prev[anomaly.id] }))}>
                          {expanded[anomaly.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expanded[anomaly.id] ? 'Less detail' : 'More detail'}
                        </Button>
                        <Link to={`/payslip/${anomaly.payslip_id}`}>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7"><Eye className="h-3 w-3" /> View payslip</Button>
                        </Link>
                        <Link to={`/draft/${anomaly.payslip_id}`}>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7"><MessageSquare className="h-3 w-3" /> Draft query</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Anomaly detection is based on structured rule checks. Findings are guidance, not formal advice.
        </p>
      </div>
    </AppLayout>
  );
};

export default Anomalies;
