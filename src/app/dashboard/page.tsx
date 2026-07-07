import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardList, MapPin, CalendarClock, FileClock } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { statusColor, complianceStatus } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('users').select('company_id, full_name, role').eq('id', user.id).single();
  if (!profile?.company_id) redirect('/onboarding');

  const [{ data: company }, { data: sites }, { data: recentInspections }, { data: compliance }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', profile.company_id).single(),
    supabase.from('sites').select('id, status').eq('company_id', profile.company_id),
    supabase
      .from('inspections')
      .select('id, status, created_at, sites(name), users!inspections_inspector_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('compliance').select('*').order('expiry_date', { ascending: true }).limit(5),
  ]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: inspectionsThisWeek } = await supabase
    .from('inspections')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString());

  const { count: pendingReports } = await supabase
    .from('inspections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft');

  const upcomingComplianceCount = (compliance || []).filter((c) => complianceStatus(c.expiry_date, c.reminder_days) !== 'green').length;

  const stats = [
    { label: 'Total Sites', value: sites?.filter((s) => s.status === 'active').length ?? 0, icon: MapPin },
    { label: 'Inspections This Week', value: inspectionsThisWeek ?? 0, icon: ClipboardList },
    { label: 'Upcoming Compliance', value: upcomingComplianceCount, icon: CalendarClock },
    { label: 'Pending Reports', value: pendingReports ?? 0, icon: FileClock },
  ];

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {profile.full_name?.split(' ')[0] || 'there'}</h1>
            {company && (
              <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(company.subscription_status)}`}>
                {company.subscription_status === 'trial'
                  ? `Trial ends ${new Date(company.trial_ends_at).toLocaleDateString()}`
                  : company.subscription_status}
              </span>
            )}
          </div>
          <Link href="/inspections/new" className="btn-primary">
            Start New Inspection
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="card">
              <Icon className="h-5 w-5 text-brand-600" />
              <div className="mt-3 text-2xl font-bold">{value}</div>
              <div className="text-sm text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="font-semibold">Recent Activity</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {recentInspections && recentInspections.length > 0 ? (
              recentInspections.map((insp: any) => (
                <Link
                  key={insp.id}
                  href={`/inspections/${insp.id}`}
                  className="flex items-center justify-between py-3 text-sm hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium">{insp.sites?.name || 'Unknown site'}</div>
                    <div className="text-gray-500">
                      {insp.users?.full_name || 'Unassigned'} · {new Date(insp.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      insp.status === 'signed'
                        ? 'bg-status-green/10 text-status-green'
                        : insp.status === 'completed'
                        ? 'bg-brand-500/10 text-brand-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {insp.status}
                  </span>
                </Link>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-gray-400">No inspections yet — start your first one above.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
