import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PayTrend } from '@/lib/types';

interface NetPayTrendChartProps {
  trends: PayTrend[];
  currencySymbol: string;
  formatCurrency: (value: number) => string;
}

/**
 * Recharts is substantial, so the dashboard imports this only when a person
 * has enough confirmed pay history for a trend to be meaningful.
 */
const NetPayTrendChart = ({ trends, currencySymbol, formatCurrency }: NetPayTrendChartProps) => {
  const first = trends[0];
  const latest = trends[trends.length - 1];
  const summary = `Net and gross pay from ${first?.month ?? 'your first saved payslip'} to ${latest?.month ?? 'your latest saved payslip'}. Latest net pay ${formatCurrency(latest?.net ?? 0)} and gross pay ${formatCurrency(latest?.gross ?? 0)}.`;

  return (
    <div className="h-full" aria-describedby="net-pay-trend-summary">
      <p id="net-pay-trend-summary" className="sr-only">{summary}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trends} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E0FA" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64658D' }} stroke="#E5E0FA" />
          <YAxis tick={{ fontSize: 12, fill: '#64658D' }} stroke="#E5E0FA" tickFormatter={(value) => `${currencySymbol}${value}`} />
          <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="net" stroke="#704BFF" strokeWidth={3} dot={{ r: 4, fill: '#704BFF', strokeWidth: 0 }} name="Net pay" />
          <Line type="monotone" dataKey="gross" stroke="#0989A5" strokeDasharray="6 4" strokeWidth={2} dot={{ r: 3, fill: '#0989A5', strokeWidth: 0 }} name="Gross pay" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetPayTrendChart;
