import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { acceptsRealPayslips } from '@/lib/public-legal-details';

const GuideCTA = () => (
  <section className="my-12 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-8 md:p-12 text-center">
    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
      {acceptsRealPayslips ? 'Want to check what changed on your payslip?' : 'Want to see a complete payday review?'}
    </h2>
    <p className="mt-3 mx-auto max-w-xl text-muted-foreground">
      {acceptsRealPayslips
        ? "Upload this month's payslip, compare it to last month, and spot issues faster."
        : 'Explore a fictional sample from confirmed figures through comparison and tax-year review. No account or document needed.'}
    </p>
    <div className="mt-6 flex justify-center">
      <Button asChild size="lg" className="gap-2 px-6">
        <Link to="/sign-up">
          {acceptsRealPayslips ? 'Start checking payslips' : 'Explore the preview'} <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
    <p className="mt-4 text-xs text-muted-foreground">
      Built for UK and Ireland employees.
    </p>
  </section>
);

export default GuideCTA;
