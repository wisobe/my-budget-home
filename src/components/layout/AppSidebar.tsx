import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  CreditCard,
  Settings,
  Link2,
  Wallet,
  LogOut,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

const navigationKeys = [
  { key: 'nav.dashboard', href: '/', icon: LayoutDashboard },
  { key: 'nav.transactions', href: '/transactions', icon: ArrowLeftRight },
  { key: 'nav.reports', href: '/reports', icon: PieChart },
  { key: 'nav.accounts', href: '/accounts', icon: CreditCard },
  { key: 'nav.connections', href: '/connections', icon: Link2 },
  { key: 'nav.settings', href: '/settings', icon: Settings },
];

const adminNavigationKeys = [
  { key: 'nav.users', href: '/admin/users', icon: Users },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { logout, authEnabled, user, isAdmin } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Wallet className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">{t('app.name')}</h1>
            <p className="text-xs text-sidebar-foreground/60">{t('app.tagline')}</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarMenu>
          {navigationKeys.map((item) => {
            const isActive = location.pathname === item.href;
            const name = t(item.key);
            return (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={name}
                >
                  <Link to={item.href}>
                    <item.icon className="h-5 w-5" />
                    <span>{name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-sidebar-border">
            <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">{t('nav.admin')}</p>
            <SidebarMenu>
              {adminNavigationKeys.map((item) => {
                const isActive = location.pathname === item.href;
                const name = t(item.key);
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={name}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-5 w-5" />
                        <span>{name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        {user && (
          <div className="px-3 pb-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
          </div>
        )}
        {authEnabled && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout} tooltip={t('nav.logout')}>
                <LogOut className="h-5 w-5" />
                <span>{t('nav.logout')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
