import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/layout/AppLayout';
import { demoPayslips, demoAnomalies, demoPayTrends, formatCurrency, formatDate } from '@/lib/demo-data';
import {
  Upload,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const Dashboard = () => {
  const latest = demoPayslips[demoPayslips.length - 1];
  const previous = demoPayslips[demoPayslips.length - 2];
  const netChange = latest.net_pay - previous.net_pay;
  const unresolvedCount = demoAnomalies.filter((a) => a.status === 'new').length;

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Good morning ✋</h1>
            <p className="mt-1 text-muted-foreground">Here's your pay overview for the last 6 months.</p>
          </div>
          <Link to="/vault">
            <Button className="gap-2"><Upload className="h-4 w-4" /> Upload payslip</Button>
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Latest net pay</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(latest.net_pay)}</div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {netChange >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className={netChange >= 0 ? 'text-success' : 'text-destructive'}>
                  {formatCurrency(Math.abs(netChange))} vs last month
                </span>
              </div>
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
              <Link to="/anomalies" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Review now <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total payslips</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{demoPayslips.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">Since Oct 2025</div>
            </CardContent>
          </Card>
        </div>

        {/* Chart + anomalies */}
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="border-0 shadow-sm lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Net pay trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={demoPayTrends} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `£${v}`} />
                    <Tooltip formatter={(val: number) => [`£${val.toFixed(2)}`, '']} />
                    <Line type="monotone" dataKey="net" stroke="hsl(217, 72%, 30%)" strokeWidth={2} dot={{ r: 4 }} name="Net pay" />
                    <Line type="monotone" dataKey="gross" stroke="hsl(172, 50%, 36%)" strokeWidth={2} dot={{ r: 4 }} name="Gross pay" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent anomalies</CardTitle>
                <Link to="/anomalies" className="text-xs text-primary hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {demoAnomalies.filter((a) => a.status === 'new').slice(0, 4).map((anomaly) => (
                  <Link
                    key={anomaly.id}
                    to={`/payslip/${anomaly.payslip_id}`}
                    className="flex items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                  >
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
              {demoPayslips.slice().reverse().slice(0, 4).map((slip) => (
                <Link
                  key={slip.id}
                  to={`/payslip/${slip.id}`}
                  className="flex items-center gap-4 py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
                >
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

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center pb-4">
          PayCheck provides guidance and issue spotting — not formal tax, legal, or payroll advice. Always confirm findings with your employer or a professional.
        </p>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
