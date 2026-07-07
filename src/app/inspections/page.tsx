'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';

interface InspectionRow {
  id: string;
  status: string;
  created_at: string;
  sites: { name: string } | null;
  users: { full_name: string | null; email: string } | null;
}

export default function InspectionsPage() {
  const searchParams = useSearchParams();
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    const siteId = searchParams.get('site_id');
    if (siteId) params.set('site_id', siteId);
    if (statusFilter) params.set('status', statusFilter);

    fetch(`/api/inspections?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setInspections(data.inspections || []);
        setLoading(false);
      });
  }, [searchParams, statusFilter]);

  const statusBadge: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    completed: 'bg-brand-500/10 text-brand-600',
    signed: 'bg-status-green/10 text-status-green',
  };

  return (
    <DashboardShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inspections</h1>
        <Link href="/inspections/new" className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" /> New Inspection
        </Link>
      </div>

      <div className="mt-4 flex gap-2">
        {['', 'draft', 'completed', 'signed'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              statusFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Inspector</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : inspections.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No inspections found.
                </td>
              </tr>
            ) : (
              inspections.map((insp) => (
                <tr key={insp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/inspections/${insp.id}`} className="font-medium text-brand-700">
                      {insp.sites?.name || 'Unknown site'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{insp.users?.full_name || insp.users?.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(insp.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[insp.status]}`}>{insp.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
