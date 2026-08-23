import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TaxEstimateUnavailableProps {
  message: string;
}

/** A clear, non-alarming state used whenever a tax table has expired. */
const TaxEstimateUnavailable = ({ message }: TaxEstimateUnavailableProps) => (
  <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
    <CardContent className="flex gap-3 p-5">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <div>
        <h2 className="font-semibold text-foreground">Tax estimate update in progress</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{message}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your confirmed payslip figures, history, and month-to-month comparisons remain available.
        </p>
      </div>
    </CardContent>
  </Card>
);

export default TaxEstimateUnavailable;
