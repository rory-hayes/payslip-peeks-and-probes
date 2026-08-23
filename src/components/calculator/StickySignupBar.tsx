import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

/**
 * Mid-conversion sticky bar that appears once the user has scrolled past the
 * first calculator result. Dismissible per-session.
 */
const StickySignupBar = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('signup-bar-dismissed') === '1');

  useEffect(() => {
    if (dismissed) return;
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [dismissed]);

  if (dismissed || !visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur shadow-2xl">
      <div className="container flex items-center justify-between gap-4 py-3">
        <div className="text-sm">
          <span className="font-medium text-foreground">Like what you see?</span>{' '}
          <span className="text-muted-foreground hidden sm:inline">
            Sign up free to track your real payslips and catch mistakes automatically.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" className="min-h-11 gap-1.5">
            <Link to="/sign-up">
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <button
            onClick={() => {
              sessionStorage.setItem('signup-bar-dismissed', '1');
              setDismissed(true);
            }}
            className="min-h-11 min-w-11 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default StickySignupBar;
