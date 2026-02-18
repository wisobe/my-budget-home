import { Link, useLocation } from 'react-router-dom';
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

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Reports', href: '/reports', icon: PieChart },
  { name: 'Accounts', href: '/accounts', icon: CreditCard },
  { name: 'Connections', href: '/connections', icon: Link2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const adminNavigation = [
  { name: 'Users', href: '/admin/users', icon: Users },
];

export function AppSidebar() {
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
            <h1 className="text-lg font-bold text-sidebar-foreground">BudgetWise</h1>
            <p className="text-xs text-sidebar-foreground/60">Personal Finance</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarMenu>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.name}
                >
                  <Link to={item.href}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-sidebar-border">
            <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">Admin</p>
            <SidebarMenu>
              {adminNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
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
              <SidebarMenuButton onClick={logout} tooltip="Logout">
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
