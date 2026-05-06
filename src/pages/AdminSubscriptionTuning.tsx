import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { subscriptionsApi } from '@/lib/api';
import { usePlaidEnvironment } from '@/contexts/PlaidEnvironmentContext';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Info, RotateCcw, Save, FlaskConical, Search } from 'lucide-react';

type ParamKey = string;

interface ParamMeta {
  key: ParamKey;
  label: string;
  help: string;
  impact: string;
  group: string;
  step?: number;
  min?: number;
  max?: number;
}

const PARAM_META: ParamMeta[] = [
  // Filtering
  { key: 'lookback_months', label: 'Lookback window (months)', group: 'Filtering',
    help: 'How far back transactions are scanned for recurring charges.',
    impact: 'Lower = faster, fewer false positives. Higher = catches annual subscriptions.', min: 1, max: 60 },
  { key: 'min_occurrences', label: 'Minimum occurrences', group: 'Filtering',
    help: 'A merchant must have at least this many charges to qualify as a subscription.',
    impact: 'Set to 2 to detect new subs faster. 3+ filters out coincidences.', min: 2, max: 12 },
  { key: 'min_key_length', label: 'Minimum merchant key length', group: 'Filtering',
    help: 'Reject normalized merchant names shorter than this many chars.',
    impact: 'Prevents matching very short/garbage merchant names.', min: 1, max: 10 },
  { key: 'fuzzy_min_prefix', label: 'Fuzzy prefix merge length', group: 'Filtering',
    help: 'Minimum shared prefix length to merge similar merchants (e.g. "netflix" + "netflix com").',
    impact: 'Lower = merges more aggressively (risk of false merges). Higher = stricter.', min: 2, max: 12 },

  // Cadence buckets
  { key: 'weekly_min',    label: 'Weekly: min days',   group: 'Weekly bucket',    help: 'Lower bound of the weekly interval window.', impact: 'Widen to catch shifted weekly charges.' },
  { key: 'weekly_days',   label: 'Weekly: expected',   group: 'Weekly bucket',    help: 'Expected interval in days for weekly cadence.', impact: 'Used for variance + next-charge prediction.' },
  { key: 'weekly_max',    label: 'Weekly: max days',   group: 'Weekly bucket',    help: 'Upper bound of the weekly interval window.', impact: 'Widen to be more lenient.' },

  { key: 'biweekly_min',  label: 'Biweekly: min',      group: 'Biweekly bucket',  help: 'Lower bound of the biweekly window.', impact: '' },
  { key: 'biweekly_days', label: 'Biweekly: expected', group: 'Biweekly bucket',  help: 'Expected biweekly interval.', impact: '' },
  { key: 'biweekly_max',  label: 'Biweekly: max',      group: 'Biweekly bucket',  help: 'Upper bound of the biweekly window.', impact: '' },

  { key: 'monthly_min',   label: 'Monthly: min',       group: 'Monthly bucket',   help: 'Lower bound of the monthly window.',
    impact: 'Most subs are monthly — too narrow rejects valid ones. Try 25.' },
  { key: 'monthly_days',  label: 'Monthly: expected',  group: 'Monthly bucket',   help: 'Expected interval in days (default 30).', impact: '' },
  { key: 'monthly_max',   label: 'Monthly: max',       group: 'Monthly bucket',   help: 'Upper bound of the monthly window.',
    impact: 'Raise (e.g. 40) for charges that drift to mid-month.' },

  { key: 'quarterly_min', label: 'Quarterly: min',     group: 'Quarterly bucket', help: 'Lower bound of the quarterly window.', impact: '' },
  { key: 'quarterly_days',label: 'Quarterly: expected',group: 'Quarterly bucket', help: 'Expected interval (default 91).', impact: '' },
  { key: 'quarterly_max', label: 'Quarterly: max',     group: 'Quarterly bucket', help: 'Upper bound of the quarterly window.', impact: '' },

  { key: 'annual_min',    label: 'Annual: min',        group: 'Annual bucket',    help: 'Lower bound of the annual window.', impact: '' },
  { key: 'annual_days',   label: 'Annual: expected',   group: 'Annual bucket',    help: 'Expected interval (default 365).', impact: '' },
  { key: 'annual_max',    label: 'Annual: max',        group: 'Annual bucket',    help: 'Upper bound of the annual window.', impact: '' },

  // Variance
  { key: 'interval_variance_pct', label: 'Interval variance (%)', group: 'Variance checks',
    help: 'Max allowed standard deviation of intervals, as % of expected days.',
    impact: 'Raise to be more lenient with billing-date drift.', min: 1, max: 100 },
  { key: 'interval_variance_min_count', label: 'Skip interval check if intervals ≤', group: 'Variance checks',
    help: 'When fewer intervals exist than this, the variance check is skipped.',
    impact: 'Lower = stricter (check applies sooner).', min: 0, max: 20 },
  { key: 'interval_outlier_trim', label: 'Interval outlier trim', group: 'Variance checks',
    help: 'Before computing interval variance, drop this many intervals furthest from the expected cadence. Useful when a one-off billing-date change creates a bad month (e.g. Netflix plan change mid-cycle: 15, 31, 28, 31 → trim drops the 15).',
    impact: '0 = off (strict). 1 = ignore one bad month (recommended). 2+ = very lenient, risks false positives.', min: 0, max: 5 },
  { key: 'amount_variance_pct', label: 'Amount variance (%)', group: 'Variance checks',
    help: 'Max allowed std-dev of amounts, as % of mean. FOREIGN-CURRENCY subs (USD/EUR) need higher values because FX drift creates CAD variance.',
    impact: 'For Netflix-type USD subs, try 15–20%. Default 10% rejects FX-volatile charges.', min: 1, max: 100 },
  { key: 'amount_variance_min_count', label: 'Skip amount check if amounts ≤', group: 'Variance checks',
    help: 'When fewer amounts exist than this, the amount check is skipped.',
    impact: 'Lower = stricter.', min: 0, max: 20 },

  // Status
  { key: 'due_soon_multiplier', label: '"Due soon" multiplier', group: 'Status',
    help: 'A subscription is "due soon" when days-since-last > expected × this.',
    impact: 'Cosmetic only (status badge). 0.8 = warn at 80% of cycle.', step: 0.05, min: 0, max: 2 },
  { key: 'missed_multiplier', label: '"Missed" multiplier', group: 'Status',
    help: 'A subscription is "missed" when days-since-last > expected × this.',
    impact: 'Cosmetic only. 1.5 = mark missed when 50% past expected date.', step: 0.05, min: 1, max: 5 },
  { key: 'price_change_threshold', label: 'Price change threshold (%)', group: 'Status',
    help: 'Flag a price change when the latest amount differs from prior by this much.',
    impact: 'Cosmetic only — affects the price-change badge.', min: 0, max: 100 },
];

const groupOrder = [
  'Filtering', 'Weekly bucket', 'Biweekly bucket', 'Monthly bucket',
  'Quarterly bucket', 'Annual bucket', 'Variance checks', 'Status',
];

function ParamRow({ meta, value, defaultValue, onChange }: {
  meta: ParamMeta; value: number; defaultValue: number; onChange: (v: number) => void;
}) {
  const isModified = value !== defaultValue;
  return (
    <div className="grid grid-cols-12 gap-3 items-start py-2">
      <div className="col-span-12 md:col-span-5">
        <div className="flex items-center gap-2">
          <Label className="text-sm">{meta.label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs"><strong>What:</strong> {meta.help}</p>
                {meta.impact && <p className="text-xs mt-1"><strong>Impact:</strong> {meta.impact}</p>}
                <p className="text-xs mt-1 text-muted-foreground">Default: {defaultValue}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isModified && <Badge variant="secondary" className="text-[10px] h-4 px-1">modified</Badge>}
        </div>
      </div>
      <div className="col-span-6 md:col-span-3">
        <Input
          type="number"
          step={meta.step ?? 1}
          min={meta.min}
          max={meta.max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8"
        />
      </div>
      <div className="col-span-6 md:col-span-4 text-xs text-muted-foreground">
        {meta.impact || meta.help}
      </div>
    </div>
  );
}

const AdminSubscriptionTuning = () => {
  const { t } = useTranslation();
  const { plaidEnvironment } = usePlaidEnvironment();

  const tuningQ = useQuery({
    queryKey: ['sub-tuning'],
    queryFn: () => subscriptionsApi.getTuning(),
  });

  const [draft, setDraft] = useState<Record<string, number>>({});
  const [defaults, setDefaults] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});

  useEffect(() => {
    const d = tuningQ.data?.data;
    if (d) {
      setDraft(d.params);
      setSaved(d.params);
      setDefaults(d.defaults);
    }
  }, [tuningQ.data]);

  const dirty = useMemo(
    () => Object.keys(draft).some(k => draft[k] !== saved[k]),
    [draft, saved],
  );

  // Overrides relative to *saved*: only what differs is sent for live testing
  const overrides = useMemo(() => {
    const o: Record<string, number> = {};
    Object.keys(draft).forEach(k => {
      if (draft[k] !== saved[k]) o[k] = draft[k];
    });
    return o;
  }, [draft, saved]);

  const grouped = useMemo(() => {
    const map: Record<string, ParamMeta[]> = {};
    PARAM_META.forEach(m => { (map[m.group] ||= []).push(m); });
    return map;
  }, []);

  const onSave = async () => {
    try {
      await subscriptionsApi.saveTuning(draft);
      setSaved(draft);
      toast.success('Tuning saved');
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    }
  };

  const onReset = async () => {
    try {
      const res = await subscriptionsApi.resetTuning();
      const params = res.data?.params ?? defaults;
      setDraft(params);
      setSaved(params);
      toast.success('Reset to defaults');
    } catch (e: any) {
      toast.error(e?.message || 'Reset failed');
    }
  };

  // Debug / live test
  const [search, setSearch] = useState('');
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugRes, setDebugRes] = useState<Awaited<ReturnType<typeof subscriptionsApi.debug>>['data'] | null>(null);

  const runDebug = async () => {
    if (!search.trim()) return;
    setDebugLoading(true);
    try {
      const res = await subscriptionsApi.debug(search.trim(), plaidEnvironment, overrides);
      setDebugRes(res.data ?? null);
    } catch (e: any) {
      toast.error(e?.message || 'Debug failed');
    } finally {
      setDebugLoading(false);
    }
  };

  if (tuningQ.isLoading) {
    return (
      <AppLayout title="Subscription Tuning">
        <Skeleton className="h-96" />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Subscription Tuning">
      <div className="space-y-6 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" /> Detection parameters
            </CardTitle>
            <CardDescription>
              Tune how the subscription detector identifies recurring charges.
              Hover the <Info className="inline h-3 w-3" /> next to each parameter for details and impact.
              Use the test panel below to preview changes <strong>before</strong> saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupOrder.map(group => (
              <div key={group}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</h3>
                <div className="divide-y">
                  {grouped[group]?.map(meta => (
                    <ParamRow
                      key={meta.key}
                      meta={meta}
                      value={draft[meta.key] ?? defaults[meta.key] ?? 0}
                      defaultValue={defaults[meta.key] ?? 0}
                      onChange={(v) => setDraft(d => ({ ...d, [meta.key]: v }))}
                    />
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button onClick={onSave} disabled={!dirty}>
                <Save className="h-4 w-4 mr-2" /> Save changes
              </Button>
              <Button variant="outline" onClick={() => setDraft(saved)} disabled={!dirty}>
                Discard
              </Button>
              <Button variant="ghost" onClick={onReset}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
              </Button>
              {dirty && <span className="text-xs text-amber-600 ml-2">{Object.keys(overrides).length} unsaved changes — use Test panel to preview</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" /> Test a merchant
            </CardTitle>
            <CardDescription>
              Search for a merchant (e.g. "netflix") to see why it is or isn't detected as a subscription
              under the {dirty ? 'DRAFT' : 'saved'} parameters in the <strong>{plaidEnvironment}</strong> environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="netflix, spotify, ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runDebug()}
              />
              <Button onClick={runDebug} disabled={debugLoading || !search.trim()}>
                {debugLoading ? 'Testing…' : 'Test'}
              </Button>
            </div>

            {debugRes && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {debugRes.would_detect ? (
                      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Would be detected
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> Would NOT be detected
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {debugRes.eligible_count} eligible / {debugRes.total_found} matching transactions
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {debugRes.checks.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {c.pass
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-muted-foreground">{c.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {debugRes.interval_stats && (
                  <div className="text-xs text-muted-foreground">
                    <strong>Intervals (days):</strong> {debugRes.interval_stats.intervals.join(', ')} ·
                    median {debugRes.interval_stats.median} · range {debugRes.interval_stats.min}–{debugRes.interval_stats.max}
                  </div>
                )}
                {debugRes.amount_stats && (
                  <div className="text-xs text-muted-foreground">
                    <strong>Amounts:</strong> mean ${debugRes.amount_stats.mean} · std ${debugRes.amount_stats.std_dev} · CV {debugRes.amount_stats.cv_percent}%
                  </div>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Matched transactions ({debugRes.transactions.length})
                  </summary>
                  <div className="mt-2 max-h-72 overflow-y-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Name</th>
                          <th className="text-right p-2">Amount</th>
                          <th className="text-left p-2">Filter reasons</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debugRes.transactions.map((t) => (
                          <tr key={t.txn_id} className="border-t">
                            <td className="p-2 tabular-nums">{t.date}</td>
                            <td className="p-2">{t.merchant_name || t.name}</td>
                            <td className="p-2 text-right tabular-nums">{Number(t.amount).toFixed(2)}</td>
                            <td className="p-2">
                              {t.filter_reasons.length === 0
                                ? <Badge variant="outline" className="text-[10px]">eligible</Badge>
                                : <span className="text-destructive">{t.filter_reasons.join(', ')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Normalized merchant keys
                  </summary>
                  <div className="mt-2 space-y-1">
                    {Object.entries(debugRes.normalized_keys).map(([raw, key]) => (
                      <div key={raw} className="flex gap-2">
                        <span className="text-muted-foreground">{raw}</span>
                        <span>→</span>
                        <code className="bg-muted px-1 rounded">{key}</code>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminSubscriptionTuning;
