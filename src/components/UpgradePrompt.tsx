import { Link } from 'react-router-dom';
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
  description = 'Unlock unlimited uploads, full anomaly detection, and more.',
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
      <Link to="/pricing">
        <Button size="sm" className="shrink-0">View plans</Button>
      </Link>
    </CardContent>
  </Card>
);

export default UpgradePrompt;
