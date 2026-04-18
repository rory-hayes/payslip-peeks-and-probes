import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

interface RelatedGuide {
  title: string;
  to?: string;
  comingSoon?: boolean;
}

const RelatedGuides = ({ heading = 'Related guides', items }: { heading?: string; items: RelatedGuide[] }) => (
  <section className="my-10">
    <h2 className="text-xl font-bold text-foreground mb-4">{heading}</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((g) => {
        const inner = (
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm font-medium text-foreground">{g.title}</span>
            {g.comingSoon ? (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Coming soon</span>
            ) : (
              <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </CardContent>
        );
        return g.to && !g.comingSoon ? (
          <Link key={g.title} to={g.to} className="block">
            <Card className="transition-colors hover:border-primary/40">{inner}</Card>
          </Link>
        ) : (
          <Card key={g.title} className="opacity-70">{inner}</Card>
        );
      })}
    </div>
  </section>
);

export default RelatedGuides;
