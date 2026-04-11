import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useProfile } from '@/hooks/use-profile';

const Pricing = () => {
  const { data: profile } = useProfile();
  const isIreland = profile?.country === 'Ireland';
  const sym = isIreland ? '€' : '£';
  const price = isIreland ? '5.99' : '4.99';

  return (
    <AppLayout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plans & Pricing</h1>
            <p className="text-sm text-muted-foreground">Choose the plan that works for you</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border shadow-sm">
            <CardContent className="p-8">
              <h3 className="text-lg font-semibold text-foreground">Free</h3>
              <div className="mt-4"><span className="text-4xl font-bold text-foreground">{sym}0</span><span className="text-muted-foreground">/month</span></div>
              <p className="mt-2 text-sm text-muted-foreground">Great for getting started and checking occasional payslips.</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {['3 payslip uploads per month', 'Basic anomaly checks', '1 month comparison', '2 issue drafts per month', 'Email support'].map((f, i) => (
                  <li key={i} className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}</li>
                ))}
              </ul>
              <Button variant="outline" className="w-full mt-8">Current plan</Button>
            </CardContent>
          </Card>
          <Card className="border-2 border-primary shadow-lg relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
            </div>
            <CardContent className="p-8">
              <h3 className="text-lg font-semibold text-foreground">Plus</h3>
              <div className="mt-4"><span className="text-4xl font-bold text-foreground">{sym}{price}</span><span className="text-muted-foreground">/month</span></div>
              <p className="mt-2 text-sm text-muted-foreground">Full access to all features. Peace of mind, every pay day.</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {['Unlimited payslip uploads', 'Full anomaly detection suite', 'Compare any two payslips', 'Unlimited issue drafts', 'Historical trends & deep insights', 'Priority support'].map((f, i) => (
                  <li key={i} className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}</li>
                ))}
              </ul>
              {/* IMPLEMENTATION NOTE: Connect to Stripe for payment processing. 
                   Configure PayCheck branding in Stripe dashboard. */}
              <Button className="w-full mt-8">Upgrade to Plus</Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Cancel anytime. No lock-in. All prices include VAT where applicable.
        </p>
      </div>
    </AppLayout>
  );
};

export default Pricing;
