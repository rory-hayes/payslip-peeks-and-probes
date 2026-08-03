import type { ReactNode } from "react";
import { Link, type To } from "react-router-dom";

interface DemoReadOnlyLinkProps {
  children: ReactNode;
  className?: string;
  isDemo: boolean;
  to: To;
}

/**
 * Demo data is intentionally read-only. Preserve the visual hierarchy of an
 * item row without sending a demo visitor to a protected, data-backed route.
 */
const DemoReadOnlyLink = ({ children, className, isDemo, to }: DemoReadOnlyLinkProps) => {
  if (isDemo) {
    return (
      <div aria-disabled="true" className={className} data-demo-read-only="true">
        {children}
      </div>
    );
  }

  return <Link className={className} to={to}>{children}</Link>;
};

export default DemoReadOnlyLink;
