import { Link } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface UpgradePromptProps {
  title?: string;
  description?: string;
  className?: string;
}

const UpgradePrompt = ({
  title = 'Upgrade to Plus',
  description = 'See Plus options for up to 6 automatic payslip checks and 12 payroll-message drafts per calendar month.',
  className = '',
}: UpgradePromptProps) => (
  <Card className={`border-primary/30 bg-primary/5 ${className}`}>
    <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild size="sm" className="min-h-11 shrink-0">
        <Link to="/pricing">View plans</Link>
      </Button>
    </CardContent>
  </Card>
);

export default UpgradePrompt;
