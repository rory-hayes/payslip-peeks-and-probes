import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertTriangle,
  CalendarDays,
  CreditCard,
  FileSearch,
  Home,
  LogOut,
  Menu,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';
import VerifyEmailBanner from '@/components/VerifyEmailBanner';
import brandMark from '@/assets/payslip-insights-mark.webp';

const primaryNavItems = [
  { label: 'Home', icon: Home, path: '/dashboard' },
  { label: 'Pay check', icon: FileSearch, path: '/vault' },
  { label: 'Plan', icon: CalendarDays, path: '/plan' },
  { label: 'Me', icon: UserRound, path: '/settings' },
];

const secondaryNavItems = [
  { label: 'Things to check', icon: AlertTriangle, path: '/anomalies' },
];

type NavigationItem = (typeof primaryNavItems)[number] | (typeof secondaryNavItems)[number];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isDemo } = useDemo();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    if (isDemo) {
      navigate('/', { state: { exitDemo: true } });
      return;
    }

    await signOut();
    navigate('/');
  };

  const visiblePrimaryItems = isDemo
    ? primaryNavItems.filter((item) => item.path === '/dashboard')
    : primaryNavItems;
  const visibleSecondaryItems = isDemo ? [] : secondaryNavItems;

  const isActive = (item: NavigationItem) => {
    if (item.path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname === item.path;
  };

  const NavLinks = ({
    items,
    onSelect,
    compact = false,
  }: {
    items: NavigationItem[];
    onSelect?: () => void;
    compact?: boolean;
  }) => (
    <div className={compact ? 'pi-tab-list' : 'pi-nav-list'}>
      {items.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={compact ? `pi-tab-link ${active ? 'is-active' : ''}` : `pi-nav-link ${active ? 'is-active' : ''}`}
            key={item.path}
            onClick={onSelect}
            to={item.path}
          >
            <Icon aria-hidden="true" className={compact ? 'pi-tab-icon' : 'pi-nav-icon'} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="pi-app-shell">
      <aside className="pi-sidebar" role="navigation" aria-label="Main navigation">
        <Link className="pi-brand pi-brand--sidebar" to="/dashboard">
          <img alt="" aria-hidden="true" className="pi-brand-mark" src={brandMark} />
          <span className="pi-brand-copy"><strong>Payslip</strong><small>Insights</small></span>
        </Link>

        <nav className="pi-sidebar-nav" aria-label="Your payslip tools">
          <NavLinks items={visiblePrimaryItems} />
          {visibleSecondaryItems.length > 0 ? (
            <div className="pi-nav-secondary">
              <p>Keep an eye on</p>
              <NavLinks items={visibleSecondaryItems} />
            </div>
          ) : null}
        </nav>

        <div className="pi-sidebar-footer">
          <Link
            className="pi-upgrade-link"
            state={isDemo ? { exitDemo: true } : undefined}
            to="/pricing"
          >
            <CreditCard aria-hidden="true" />
            <span>See Plus</span>
          </Link>
          <button className="pi-sign-out" onClick={() => void handleSignOut()} type="button">
            <LogOut aria-hidden="true" />
            <span>{isDemo ? 'Exit demo' : 'Sign out'}</span>
          </button>
        </div>
      </aside>

      <div className="pi-app-content">
        <VerifyEmailBanner />
        <header className="pi-mobile-header">
          <Link className="pi-brand" to="/dashboard">
            <img alt="" aria-hidden="true" className="pi-brand-mark" src={brandMark} />
            <span className="pi-brand-copy"><strong>Payslip</strong><small>Insights</small></span>
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="pi-profile-button" variant="ghost" size="icon" aria-label="Open menu">
                <Menu aria-hidden="true" className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="pi-mobile-menu w-[20rem] p-5" side="right">
              <div className="pi-mobile-menu-brand">
                <img alt="" aria-hidden="true" className="pi-brand-mark" src={brandMark} />
                <span className="pi-brand-copy"><strong>Payslip</strong><small>Insights</small></span>
              </div>
              <nav className="mt-8" aria-label="Menu navigation">
                <NavLinks items={visiblePrimaryItems} onSelect={() => setOpen(false)} />
                {visibleSecondaryItems.length > 0 ? <NavLinks items={visibleSecondaryItems} onSelect={() => setOpen(false)} /> : null}
              </nav>
              <div className="pi-mobile-menu-actions">
                <Link
                  className="pi-upgrade-link"
                  onClick={() => setOpen(false)}
                  state={isDemo ? { exitDemo: true } : undefined}
                  to="/pricing"
                >
                  <CreditCard aria-hidden="true" />
                  <span>See Plus</span>
                </Link>
                <button onClick={() => { setOpen(false); void handleSignOut(); }} type="button">
                  <LogOut aria-hidden="true" />
                  <span>{isDemo ? 'Exit demo' : 'Sign out'}</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="pi-main" role="main">{children}</main>

        <nav className="pi-bottom-tabs" aria-label="Quick navigation">
          <NavLinks compact items={visiblePrimaryItems} />
        </nav>
      </div>
    </div>
  );
};

export default AppLayout;
