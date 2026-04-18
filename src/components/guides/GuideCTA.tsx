import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const GuideCTA = () => (
  <section className="my-12 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-8 md:p-12 text-center">
    <h2 className="text-2xl md:text-3xl font-bold text-foreground">
      Want to check what changed on your payslip?
    </h2>
    <p className="mt-3 mx-auto max-w-xl text-muted-foreground">
      Upload this month's payslip, compare it to last month, and spot issues faster.
    </p>
    <div className="mt-6 flex justify-center">
      <Link to="/sign-up">
        <Button size="lg" className="gap-2 px-6">
          Start checking payslips <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
    <p className="mt-4 text-xs text-muted-foreground">
      Built for UK and Ireland employees.
    </p>
  </section>
);

export default GuideCTA;
