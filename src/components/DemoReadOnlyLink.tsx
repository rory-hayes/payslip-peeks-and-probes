import type { ReactNode } from "react";
import { Link, type To } from "react-router";

interface DemoReadOnlyLinkProps {
  children: ReactNode;
  className?: string;
  demoAriaLabel?: string;
  isDemo: boolean;
  onDemoActivate?: () => void;
  to: To;
}

/**
 * Demo data is intentionally read-only. Preserve the visual hierarchy of an
 * item row without sending a demo visitor to a protected, data-backed route.
 */
const DemoReadOnlyLink = ({
  children,
  className,
  demoAriaLabel,
  isDemo,
  onDemoActivate,
  to,
}: DemoReadOnlyLinkProps) => {
  if (isDemo) {
    if (onDemoActivate) {
      return (
        <button
          type="button"
          className={className}
          aria-label={demoAriaLabel}
          data-demo-read-only="true"
          onClick={onDemoActivate}
        >
          {children}
        </button>
      );
    }

    return (
      <div aria-disabled="true" className={className} data-demo-read-only="true">
        {children}
      </div>
    );
  }

  return <Link className={className} to={to}>{children}</Link>;
};

export default DemoReadOnlyLink;
