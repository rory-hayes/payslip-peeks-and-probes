import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import { usePayslips, useAnomalies, usePayTrends } from '@/hooks/use-payslip-data';
import { useUsage } from '@/hooks/use-usage';
import ExpectedVsActual from '@/components/ExpectedVsActual';
import ExpectedVsActualChart from '@/components/ExpectedVsActualChart';
import YearToDateSummary from '@/components/YearToDateSummary';
import YearToDateChart from '@/components/YearToDateChart';
import UpgradePrompt from '@/components/UpgradePrompt';
import { useCurrency, useProfile } from '@/hooks/use-profile';
import { formatDate } from '@/lib/date-utils';
import { generatePaySummaryPdf } from '@/lib/generate-pay-summary-pdf';
import type { Payslip, AnomalyResult, PayTrend } from '@/lib/types';
import {
  Upload, TrendingUp, TrendingDown, AlertTriangle, FileText, ArrowRight, BarChart3, Download,
  Shield, Sparkles,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const Dashboard = () => {
  const { data: payslips, isLoading: loadingSlips } = usePayslips();
  const { data: anomalies, isLoading: loadingAnomalies } = useAnomalies();
  const { data: trends } = usePayTrends();
  const { data: profile } = useProfile();
  const { format: formatCurrency, symbol: currSym, currency } = useCurrency();
  const { uploadsRemaining, draftsRemaining, isPremium, limits } = useUsage();

  const isLoading = loadingSlips || loadingAnomalies;
  const isEmpty = !isLoading && (!payslips || payslips.length === 0);

  const allPayslips: Payslip[] = payslips || [];
  const allAnomalies: AnomalyResult[] = anomalies || [];

  const latest = allPayslips.length > 0 ? allPayslips[allPayslips.length - 1] : null;
  const previous = allPayslips.length > 1 ? allPayslips[allPayslips.length - 2] : null;
  const netChange = latest && previous ? latest.net_pay - previous.net_pay : 0;
  const unresolvedCount = allAnomalies.filter((a) => a.status === 'new').length;

  const greeting = profile?.first_name ? `Hi, ${profile.first_name}` : 'Welcome';

  const handleExportPdf = () => {
    if (!allPayslips || allPayslips.length === 0) return;
    generatePaySummaryPdf({
      payslips: allPayslips,
      currency,
      country: profile?.country ?? null,
      annualSalary: profile?.annual_salary,
      deductionOpts: {
        pensionPercent: profile?.has_pension ? (profile.pension_percent ?? 5) : 0,
        hasStudentLoan: profile?.has_student_loan,
        studentLoanPlan: (profile?.student_loan_plan as any) ?? 'plan2',
      },
      firstName: profile?.first_name,
    });
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">{greeting} 👋</h1>
            <p className="mt-1 text-muted-foreground">
              {isEmpty ? 'Let\'s get started with your first payslip.' : 'Here\'s your pay overview.'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {allPayslips.length > 0 && (
              <Button variant="outline" className="gap-2" onClick={handleExportPdf}>
                <Download className="h-4 w-4" /> Export PDF
              </Button>
            )}
            <Link to="/vault">
              <Button className="gap-2"><Upload className="h-4 w-4" /> Upload payslip</Button>
            </Link>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Your pay dashboard</h3>
              <p className="mt-3 max-w-md text-muted-foreground leading-relaxed">
                Upload a payslip and PayCheck will extract the key figures, compare them against your profile, and flag anything that looks unusual. Your data stays private and secure.
              </p>
              <div className="mt-6">
                <Link to="/vault">
                  <Button className="gap-2"><Upload className="h-4 w-4" /> Upload your first payslip</Button>
                </Link>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-6 text-center">
                <div>
                  <Shield className="h-5 w-5 mx-auto text-muted-foreground/60" />
                  <p className="mt-2 text-xs text-muted-foreground">Encrypted & private</p>
                </div>
                <div>
                  <AlertTriangle className="h-5 w-5 mx-auto text-muted-foreground/60" />
                  <p className="mt-2 text-xs text-muted-foreground">Anomaly detection</p>
                </div>
                <div>
                  <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground/60" />
                  <p className="mt-2 text-xs text-muted-foreground">Track pay trends</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        {!isLoading && latest && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Latest net pay</span>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(latest.net_pay)}</div>
                  {previous && (
                    <div className="mt-1 flex items-center gap-1 text-xs">
                      {netChange >= 0 ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
                      <span className={netChange >= 0 ? 'text-success' : 'text-destructive'}>
                        {formatCurrency(Math.abs(netChange))} vs last month
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Latest gross pay</span>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(latest.gross_pay)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(latest.pay_date)}</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Open anomalies</span>
                    <AlertTriangle className="h-4 w-4 text-anomaly" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-foreground">{unresolvedCount}</div>
                  {unresolvedCount > 0 ? (
                    <Link to="/anomalies" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Review now <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <p className="mt-1 text-xs text-success">Everything looks normal</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total payslips</span>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-foreground">{allPayslips.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Stored securely</div>
                </CardContent>
              </Card>
            </div>

            {/* Free tier usage indicator */}
            {!isPremium && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">Free plan usage this month</span>
                    <Link to="/pricing">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                        <Sparkles className="h-3 w-3" /> Upgrade
                      </Button>
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Uploads</span>
                        <span>{limits.uploads_per_month - uploadsRemaining}/{limits.uploads_per_month}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${uploadsRemaining === 0 ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${((limits.uploads_per_month - uploadsRemaining) / limits.uploads_per_month) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Drafts</span>
                        <span>{limits.drafts_per_month - draftsRemaining}/{limits.drafts_per_month}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${draftsRemaining === 0 ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${((limits.drafts_per_month - draftsRemaining) / limits.drafts_per_month) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isPremium && (uploadsRemaining === 0 || draftsRemaining === 0) && (
              <UpgradePrompt
                title="You've hit your free limit"
                description="Upgrade to Plus for unlimited uploads, drafts, and full anomaly detection."
              />
            )}

            {/* Expected vs Actual comparison */}
            <ExpectedVsActual latestPayslip={latest} />
            <ExpectedVsActualChart payslips={allPayslips} />
            <YearToDateSummary payslips={allPayslips} />
            <YearToDateChart payslips={allPayslips} />

            {/* Chart + anomalies */}
            <div className="grid gap-6 lg:grid-cols-5">
              {trends && trends.length > 1 && (
                <Card className="border-0 shadow-sm lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Net pay trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
                          <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `${currSym}${v}`} />
                          <Tooltip formatter={(val: number) => [formatCurrency(val), '']} />
                          <Line type="monotone" dataKey="net" stroke="hsl(217, 72%, 30%)" strokeWidth={2} dot={{ r: 4 }} name="Net pay" />
                          <Line type="monotone" dataKey="gross" stroke="hsl(172, 50%, 36%)" strokeWidth={2} dot={{ r: 4 }} name="Gross pay" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {allAnomalies.filter((a) => a.status === 'new').length > 0 && (
                <Card className={`border-0 shadow-sm ${trends && trends.length > 1 ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Recent anomalies</CardTitle>
                      <Link to="/anomalies" className="text-xs text-primary hover:underline">View all</Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {allAnomalies.filter((a) => a.status === 'new').slice(0, 4).map((anomaly) => (
                        <Link key={anomaly.id} to={`/payslip/${anomaly.payslip_id}`} className="flex items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors">
                          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            anomaly.severity === 'high' ? 'bg-destructive/10 text-destructive' :
                            anomaly.severity === 'medium' ? 'bg-anomaly/10 text-anomaly' :
                            'bg-warning/10 text-warning'
                          }`}>
                            <AlertTriangle className="h-3 w-3" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{anomaly.title}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(anomaly.payslip_date)}</p>
                          </div>
                          <Badge variant="outline" className="ml-auto shrink-0 text-xs capitalize">{anomaly.severity}</Badge>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent payslips */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent payslips</CardTitle>
                  <Link to="/vault" className="text-xs text-primary hover:underline">View all</Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {allPayslips.slice().reverse().slice(0, 4).map((slip) => (
                    <Link key={slip.id} to={`/payslip/${slip.id}`} className="flex items-center gap-4 py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{formatDate(slip.pay_date)}</p>
                        <p className="text-xs text-muted-foreground">{slip.employer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(slip.net_pay)}</p>
                        <p className="text-xs text-muted-foreground">net</p>
                      </div>
                      {slip.anomaly_count > 0 && (
                        <Badge variant="destructive" className="text-xs">{slip.anomaly_count}</Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-xs text-muted-foreground text-center pb-4">
          PayCheck provides guidance and issue spotting — not formal tax, legal, or payroll advice. Always confirm findings with your employer or a professional.
        </p>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
