import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  FolderOpen,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  CheckCircle,
  CreditCard,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Payslip Vault', icon: FolderOpen, path: '/vault' },
  { label: 'Anomalies', icon: AlertTriangle, path: '/anomalies' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const NavLinks = ({ onSelect }: { onSelect?: () => void }) => (
    <div className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onSelect}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <CheckCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">PayCheck</span>
          </Link>
        </div>
        <nav className="flex-1 p-4">
          <NavLinks />
        </nav>
        <div className="border-t border-border p-4 space-y-1">
          <Link
            to="/pricing"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Upgrade
          </Link>
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <CheckCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">PayCheck</span>
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-4">
              <div className="mt-4">
                <NavLinks onSelect={() => setOpen(false)} />
              </div>
              <div className="mt-auto border-t border-border pt-4 space-y-1">
                <Link
                  to="/pricing"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  <CreditCard className="h-4 w-4" /> Upgrade
                </Link>
                <button
                  onClick={() => { setOpen(false); navigate('/'); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
