import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency } from '@/hooks/use-profile';
import type { Payslip } from '@/lib/types';
import { TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  payslips: Payslip[];
}

const YearToDateChart = ({ payslips }: Props) => {
  const { format: fmt, symbol } = useCurrency();
  const currentYear = new Date().getFullYear();

  const ytdSlips = payslips
    .filter((s) => new Date(s.pay_date).getFullYear() === currentYear)
    .sort((a, b) => new Date(a.pay_date).getTime() - new Date(b.pay_date).getTime());

  if (ytdSlips.length < 2) return null;

  let cumGross = 0;
  let cumTax = 0;
  let cumNet = 0;

  const data = ytdSlips.map((s) => {
    cumGross += s.gross_pay;
    cumTax += s.tax_amount;
    cumNet += s.net_pay;
    return {
      month: new Date(s.pay_date).toLocaleDateString('en-GB', { month: 'short' }),
      gross: cumGross,
      tax: cumTax,
      net: cumNet,
    };
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{currentYear} Cumulative Year-to-Date</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 72%, 30%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(217, 72%, 30%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(172, 50%, 36%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(172, 50%, 36%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradTax" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 70%, 50%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(0, 70%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" tickFormatter={(v) => `${symbol}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip formatter={(val: number) => [fmt(val), '']} />
              <Legend />
              <Area type="monotone" dataKey="gross" stroke="hsl(217, 72%, 30%)" fill="url(#gradGross)" strokeWidth={2} name="Gross" />
              <Area type="monotone" dataKey="net" stroke="hsl(172, 50%, 36%)" fill="url(#gradNet)" strokeWidth={2} name="Net" />
              <Area type="monotone" dataKey="tax" stroke="hsl(0, 70%, 50%)" fill="url(#gradTax)" strokeWidth={2} name="Tax" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default YearToDateChart;
