import { AlertTriangle, ArrowRight, Info, Lightbulb } from 'lucide-react';

interface AnomalyExplanationProps {
  description: string;
  suggestedAction: string;
  compact?: boolean;
}

function parseDescription(description: string) {
  const sections: { what?: string; why?: string; note?: string } = {};
  
  const whatMatch = description.match(/What changed:\s*([\s\S]*?)(?=\n\nWhy it matters:|$)/);
  const whyMatch = description.match(/Why it matters:\s*([\s\S]*?)(?=\n\n(?:This may be|Here's what)|$)/);
  const noteMatch = description.match(/(This may be perfectly valid.*|Here's what changed.*)/);

  if (whatMatch) {
    sections.what = whatMatch[1].trim();
    sections.why = whyMatch?.[1]?.trim();
    sections.note = noteMatch?.[1]?.trim();
  }

  return sections;
}

const AnomalyExplanation = ({ description, suggestedAction, compact = false }: AnomalyExplanationProps) => {
  const sections = parseDescription(description);
  const hasStructured = !!sections.what;

  if (!hasStructured) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        {suggestedAction && (
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">{suggestedAction}</p>
          </div>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground leading-relaxed">{sections.what}</p>
        {suggestedAction && (
          <div className="flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-primary font-medium">{suggestedAction}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What changed</p>
          <p className="text-sm text-foreground leading-relaxed">{sections.what}</p>
        </div>
      </div>

      {sections.why && (
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Why it matters</p>
            <p className="text-sm text-foreground leading-relaxed">{sections.why}</p>
          </div>
        </div>
      )}

      {suggestedAction && (
        <div className="flex items-start gap-2.5 rounded-lg bg-primary/5 border border-primary/10 p-3">
          <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">What to do next</p>
            <p className="text-sm text-foreground leading-relaxed">{suggestedAction}</p>
          </div>
        </div>
      )}

      {sections.note && (
        <p className="text-xs text-muted-foreground italic">{sections.note}</p>
      )}
    </div>
  );
};

export default AnomalyExplanation;
