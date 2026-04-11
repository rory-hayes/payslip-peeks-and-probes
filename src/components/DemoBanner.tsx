import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDemoMode } from '@/contexts/DemoContext';
import { Eye, Upload, X } from 'lucide-react';

const DemoBanner = () => {
  const { isDemoMode, disableDemo } = useDemoMode();

  if (!isDemoMode) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <Eye className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Demo mode</p>
          <p className="text-xs text-muted-foreground">You're viewing sample data. Upload your own payslip to see real insights.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/vault">
            <Button size="sm" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Upload payslip
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={disableDemo}>
            <X className="h-3.5 w-3.5" /> Exit demo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DemoBanner;
