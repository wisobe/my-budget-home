import { useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Target,
  ClipboardList,
  Database,
  RefreshCw,
  Lightbulb,
  Heart,
  Calculator,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';

interface NavItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const defaultNavigation: NavItem[] = [
  { key: 'nav.dashboard', href: '/', icon: LayoutDashboard },
  { key: 'nav.transactions', href: '/transactions', icon: ArrowLeftRight },
  { key: 'nav.budgets', href: '/budgets', icon: Target },
  { key: 'nav.reports', href: '/reports', icon: PieChart },
  { key: 'nav.accounts', href: '/accounts', icon: CreditCard },
  { key: 'nav.connections', href: '/connections', icon: Link2 },
  { key: 'nav.subscriptions', href: '/subscriptions', icon: RefreshCw },
  { key: 'nav.insights', href: '/insights', icon: Lightbulb },
  { key: 'nav.healthScore', href: '/health-score', icon: Heart },
  { key: 'nav.simulator', href: '/simulator', icon: Calculator },
  { key: 'nav.settings', href: '/settings', icon: Settings },
];

const adminNavigationKeys: NavItem[] = [
  { key: 'nav.users', href: '/admin/users', icon: Users },
  { key: 'nav.plaidConfig', href: '/admin/plaid', icon: Link2 },
  { key: 'nav.dbConnection', href: '/admin/backend', icon: Database },
  { key: 'nav.auditLog', href: '/admin/audit', icon: ClipboardList },
];

function SortableNavItem({ item, isActive, onNavigate }: { item: NavItem; isActive: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const name = t(item.key);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <div className="flex items-center group/nav-item">
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={name}
          className="flex-1"
        >
          <Link to={item.href} onClick={onNavigate}>
            <item.icon className="h-5 w-5" />
            <span>{name}</span>
          </Link>
        </SidebarMenuButton>
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover/nav-item:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing p-1 text-sidebar-foreground/40 transition-opacity shrink-0"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { logout, authEnabled, user, isAdmin } = useAuth();
  const { sidebarOrder, setSidebarOrder } = usePreferences();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileMenu = useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedNavigation = useMemo(() => {
    if (!sidebarOrder || sidebarOrder.length === 0) return defaultNavigation;
    const ordered: NavItem[] = [];
    for (const key of sidebarOrder) {
      const item = defaultNavigation.find(n => n.key === key);
      if (item) ordered.push(item);
    }
    // Append any new items not in saved order
    for (const item of defaultNavigation) {
      if (!ordered.find(n => n.key === item.key)) ordered.push(item);
    }
    return ordered;
  }, [sidebarOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedNavigation.findIndex(n => n.key === active.id);
    const newIndex = sortedNavigation.findIndex(n => n.key === over.id);
    const newOrder = arrayMove(sortedNavigation, oldIndex, newIndex);
    setSidebarOrder(newOrder.map(n => n.key));
  };

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedNavigation.map(n => n.key)}
            strategy={verticalListSortingStrategy}
          >
            <SidebarMenu>
              {sortedNavigation.map((item) => (
                <SortableNavItem
                  key={item.key}
                  item={item}
                  isActive={location.pathname === item.href}
                  onNavigate={closeMobileMenu}
                />
              ))}
            </SidebarMenu>
          </SortableContext>
        </DndContext>

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
                      <Link to={item.href} onClick={closeMobileMenu}>
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
