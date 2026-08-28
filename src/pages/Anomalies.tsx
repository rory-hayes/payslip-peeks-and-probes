import { useState } from 'react';
import { Link } from 'react-router';
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

const priorityLabels = {
  high: 'High priority',
  medium: 'Worth checking',
  low: 'For awareness',
} as const;

const Anomalies = () => {
  const [filter, setFilter] = useState<AnomalyStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data: realAnomalies, isLoading, isError, refetch } = useAnomalies();
  const updateStatus = useUpdateAnomalyStatus();

  const all = realAnomalies || [];
  const filtered = filter === 'all' ? all : all.filter((a) => a.status === filter);
  const highCount = all.filter((a) => a.severity === 'high' && a.status === 'new').length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Things to check</h1>
          <p className="text-sm text-muted-foreground">
            {isError ? 'Your check results could not be loaded.' : `${all.length} item${all.length === 1 ? '' : 's'} across your reviewed payslips`}
          </p>
        </div>

        {highCount > 0 && (
          <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{highCount} item{highCount !== 1 && 's'} worth checking soon</p>
                <p className="text-xs text-muted-foreground">A valid payroll change can trigger these too. Check the explanation before deciding what to do.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter flagged items">
          {(['all', 'new', 'reviewed', 'raised', 'resolved'] as const).map((s) => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" aria-pressed={filter === s} onClick={() => setFilter(s)} className="capitalize text-xs">
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
        ) : isError ? (
          <Card className="border-destructive/20 bg-destructive/5 shadow-sm" role="alert">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive/70" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">We couldn’t load your flagged items.</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">Your records have not been changed. Check your connection and try again before relying on this list.</p>
              <Button className="mt-5 min-h-11" onClick={() => void refetch()}>Try again</Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle className="h-12 w-12 text-success/40" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Nothing to check here</h3>
              <p className="mt-2 text-sm text-muted-foreground">No reviewed check results match this category.</p>
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
                          }`}>{priorityLabels[anomaly.severity]}</Badge>
                          <Badge variant="secondary" className="text-xs capitalize">{statusLabels[anomaly.status]}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{anomaly.employer_name} · {formatDate(anomaly.payslip_date)}</p>
                      
                      {!expanded[anomaly.id] ? (
                        <div id={`anomaly-detail-${anomaly.id}`} className="mt-2">
                          <AnomalyExplanation description={anomaly.description} suggestedAction={anomaly.suggested_action} compact />
                        </div>
                      ) : (
                        <div id={`anomaly-detail-${anomaly.id}`} className="mt-3">
                          <AnomalyExplanation description={anomaly.description} suggestedAction={anomaly.suggested_action} />
                        </div>
                      )}
                      
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" className="min-h-11 gap-1 text-xs" aria-controls={`anomaly-detail-${anomaly.id}`} aria-expanded={Boolean(expanded[anomaly.id])} onClick={() => setExpanded(prev => ({ ...prev, [anomaly.id]: !prev[anomaly.id] }))}>
                          {expanded[anomaly.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expanded[anomaly.id] ? 'Less detail' : 'More detail'}
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1 text-xs">
                          <Link to={`/payslip/${anomaly.payslip_id}`}><Eye className="h-3 w-3" /> View payslip</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1 text-xs">
                          <Link to={`/draft/${anomaly.payslip_id}`}><MessageSquare className="h-3 w-3" /> Draft query</Link>
                        </Button>
                        <div className="ml-auto flex flex-wrap gap-2">
                          {anomaly.status !== 'reviewed' && anomaly.status !== 'resolved' && anomaly.status !== 'raised' && (
                            <Button variant="outline" size="sm" className="min-h-11 gap-1 text-xs" onClick={() => updateStatus.mutate({ id: anomaly.id, status: 'reviewed' })} disabled={updateStatus.isPending}>
                              <Eye className="h-3 w-3" /> Mark reviewed
                            </Button>
                          )}
                          {anomaly.status !== 'raised' && anomaly.status !== 'resolved' && (
                            <Button variant="outline" size="sm" className="min-h-11 gap-1 text-xs" onClick={() => updateStatus.mutate({ id: anomaly.id, status: 'raised' })} disabled={updateStatus.isPending}>
                              <Send className="h-3 w-3" /> Raised with payroll
                            </Button>
                          )}
                          {anomaly.status !== 'resolved' && (
                            <Button size="sm" className="min-h-11 gap-1 text-xs" onClick={() => updateStatus.mutate({ id: anomaly.id, status: 'resolved' })} disabled={updateStatus.isPending}>
                              <CheckCircle className="h-3 w-3" /> Resolve
                            </Button>
                          )}
                          {anomaly.status !== 'new' && (
                            <Button variant="ghost" size="sm" className="min-h-11 gap-1 text-xs text-muted-foreground" onClick={() => updateStatus.mutate({ id: anomaly.id, status: 'new' })} disabled={updateStatus.isPending}>
                              <RotateCcw className="h-3 w-3" /> Reopen
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          These are structured rule checks on figures you reviewed. They are guidance, not formal payroll or tax advice.
        </p>
      </div>
    </AppLayout>
  );
};

export default Anomalies;
