import { useEffect } from "react";
import { useLocation } from "react-router";
import { useDemo } from "@/contexts/DemoContext";

const DemoExitOnArrival = () => {
  const { disableDemo, isDemo } = useDemo();
  const location = useLocation();
  const shouldExitDemo = (location.state as { exitDemo?: unknown } | null)?.exitDemo === true;

  // Clear demo state only after the public destination has mounted. Clearing
  // it on the protected dashboard click handler can redirect an
  // unauthenticated visitor to /sign-in before that destination renders.
  useEffect(() => {
    if (isDemo && shouldExitDemo) disableDemo();
  }, [disableDemo, isDemo, shouldExitDemo]);

  return null;
};

export default DemoExitOnArrival;
