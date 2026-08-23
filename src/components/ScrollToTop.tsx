import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

function getHashTarget(hash: string): HTMLElement | null {
  if (!hash || hash === '#') return null;

  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

/**
 * Route changes should start at the top of the new task, while browser Back
 * keeps its native scroll restoration and in-page anchor links keep working.
 */
const ScrollToTop = () => {
  const { hash, pathname, search } = useLocation();
  const navigationType = useNavigationType();
  const hasMounted = useRef(false);

  useEffect(() => {
    const isInitialNavigation = !hasMounted.current;
    hasMounted.current = true;

    if (!hash) {
      if (navigationType !== 'POP') window.scrollTo(0, 0);
      return;
    }

    // The initial location may be a campaign URL such as /#pricing. The
    // landing page is lazy-loaded, so observe briefly if the target is not in
    // the DOM yet. On browser Back, preserve native scroll restoration.
    if (!isInitialNavigation && navigationType === 'POP') return;

    let observer: MutationObserver | null = null;
    const scrollToTarget = () => {
      const target = getHashTarget(hash);
      if (!target) return false;

      target.scrollIntoView({ block: 'start' });
      if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
      return true;
    };

    if (!scrollToTarget()) {
      observer = new MutationObserver(() => {
        if (scrollToTarget()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => observer?.disconnect();
  }, [hash, navigationType, pathname, search]);

  return null;
};

export default ScrollToTop;
