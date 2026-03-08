import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { auditApi, authApi } from '@/lib/api';
import { Navigate } from 'react-router-dom';
import {
  Search, ChevronLeft, ChevronRight, CalendarIcon, X,
  Shield, LogIn, LogOut, UserPlus, UserMinus, UserCog, KeyRound,
  ClipboardList, Loader2,
} from 'lucide-react';
import type { AuditLogEntry } from '@/types';

const EVENT_TYPES = [
  'login_success',
  'login_failed',
  'user_created',
  'user_updated',
  'user_deleted',
  '2fa_enabled',
  '2fa_disabled',
  'password_changed',
] as const;

const eventIcon = (type: string) => {
  switch (type) {
    case 'login_success': return <LogIn className="h-4 w-4 text-income" />;
    case 'login_failed': return <LogIn className="h-4 w-4 text-destructive" />;
    case 'user_created': return <UserPlus className="h-4 w-4 text-primary" />;
    case 'user_updated': return <UserCog className="h-4 w-4 text-primary" />;
    case 'user_deleted': return <UserMinus className="h-4 w-4 text-destructive" />;
    case '2fa_enabled': return <KeyRound className="h-4 w-4 text-income" />;
    case '2fa_disabled': return <KeyRound className="h-4 w-4 text-expense" />;
    case 'password_changed': return <Shield className="h-4 w-4 text-primary" />;
    default: return <ClipboardList className="h-4 w-4 text-muted-foreground" />;
  }
};

const eventBadgeVariant = (type: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (type.includes('failed') || type.includes('deleted')) return 'destructive';
  if (type.includes('success') || type.includes('enabled') || type.includes('created')) return 'default';
  return 'secondary';
};

const AdminAuditLog = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authApi.listUsers(),
    enabled: isAdmin,
  });

  const users = usersData?.data || [];

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['audit-log', page, search, eventTypeFilter, userFilter, startDate, endDate],
    queryFn: () => auditApi.list({
      page,
      per_page: 25,
      search: search || undefined,
      event_type: eventTypeFilter !== 'all' ? eventTypeFilter : undefined,
      user_id: userFilter !== 'all' ? userFilter : undefined,
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      end_date: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    }),
    enabled: isAdmin,
  });

  const entries = auditData?.data || [];
  const totalPages = auditData?.total_pages || 1;
  const total = auditData?.total || 0;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const parseDetails = (details: string | null): Record<string, any> | null => {
    if (!details) return null;
    try { return JSON.parse(details); } catch { return null; }
  };

  const formatDetails = (entry: AuditLogEntry) => {
    const d = parseDetails(entry.details);
    if (!d) return null;

    const parts: string[] = [];
    if (d.email) parts.push(d.email);
    if (d.role) parts.push(`role: ${d.role}`);
    if (d.new_role) parts.push(`→ ${d.new_role}`);
    if (d.fields) parts.push(`fields: ${d.fields.join(', ')}`);
    if (d.name) parts.push(d.name);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  return (
    <AppLayout title={t('auditLog.title')}>
      <div className="space-y-4 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {t('auditLog.accessLog')}
            </CardTitle>
            <CardDescription>{t('auditLog.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('auditLog.searchPlaceholder')}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-9"
                  />
                </div>
                <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder={t('auditLog.allEvents')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('auditLog.allEvents')}</SelectItem>
                    {EVENT_TYPES.map(et => (
                      <SelectItem key={et} value={et}>
                        <div className="flex items-center gap-2">
                          {eventIcon(et)}
                          {t(`auditLog.events.${et}`)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder={t('auditLog.allUsers')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('auditLog.allUsers')}</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'MMM d, yyyy') : <span>{t('auditLog.startDate')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setPage(1); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  {startDate && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setStartDate(undefined); setPage(1); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'MMM d, yyyy') : <span>{t('auditLog.endDate')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setPage(1); }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  {endDate && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEndDate(undefined); setPage(1); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground ml-auto">
                  {t('auditLog.totalEntries', { count: total })}
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>{t('auditLog.event')}</TableHead>
                    <TableHead>{t('auditLog.user')}</TableHead>
                    <TableHead>{t('auditLog.target')}</TableHead>
                    <TableHead>{t('auditLog.details')}</TableHead>
                    <TableHead>{t('auditLog.ipAddress')}</TableHead>
                    <TableHead>{t('auditLog.dateTime')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t('auditLog.noEntries')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            {eventIcon(entry.event_type)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={eventBadgeVariant(entry.event_type)}>
                            {t(`auditLog.events.${entry.event_type}`, { defaultValue: entry.event_type })}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {entry.user_name ? (
                            <div>
                              <p className="text-sm font-medium">{entry.user_name}</p>
                              <p className="text-xs text-muted-foreground">{entry.user_email}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.target_user_name ? (
                            <div>
                              <p className="text-sm font-medium">{entry.target_user_name}</p>
                              <p className="text-xs text-muted-foreground">{entry.target_user_email}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const details = formatDetails(entry);
                            return details ? (
                              <p className="text-xs text-muted-foreground max-w-[200px] truncate" title={details}>
                                {details}
                              </p>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">{entry.ip_address || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(entry.created_at).toLocaleString('en-CA', {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('auditLog.pageOf', { page, total: totalPages })}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" /><ChevronLeft className="h-4 w-4 -ml-2" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {(() => {
                  const pages: (number | 'ellipsis')[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (page > 3) pages.push('ellipsis');
                    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                    if (page < totalPages - 2) pages.push('ellipsis');
                    pages.push(totalPages);
                  }
                  return pages.map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
                    ) : (
                      <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" onClick={() => setPage(p)}>
                        {p}
                      </Button>
                    )
                  );
                })()}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" /><ChevronRight className="h-4 w-4 -ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminAuditLog;
