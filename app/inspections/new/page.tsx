'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import type { Site, ChecklistTemplate } from '@/lib/types';

export default function NewInspectionPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [siteId, setSiteId] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch('/api/sites?status=active').then((r) => r.json()), fetch('/api/checklists').then((r) => r.json())]).then(
      ([sitesData, checklistsData]) => {
        setSites(sitesData.sites || []);
        setChecklists(checklistsData.checklists || []);
        const defaultChecklist = checklistsData.checklists?.find((c: ChecklistTemplate) => c.is_default);
        if (defaultChecklist) setChecklistId(defaultChecklist.id);
        setLoading(false);
      }
    );
  }, []);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    let gps: { lat?: number; lng?: number } = {};
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      gps = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      // GPS is best-effort — proceed without it if the user denies/lacks location access.
    }

    const res = await fetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: siteId, checklist_id: checklistId, gps_lat: gps.lat, gps_lng: gps.lng }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Failed to start inspection');
      return;
    }
    router.push(`/inspections/${data.inspection.id}`);
  }

  return (
    <DashboardShell>
      <h1 className="text-2xl font-bold">New Inspection</h1>

      <form onSubmit={handleStart} className="card mt-4 max-w-lg space-y-4">
        {error && <div className="rounded-lg bg-status-red/10 px-3 py-2 text-sm text-status-red">{error}</div>}

        {loading ? (
          <p className="text-sm text-gray-400">Loading sites and checklists…</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-gray-500">
            You don't have any active sites yet.{' '}
            <a href="/sites" className="font-medium text-brand-600">
              Add one first
            </a>
            .
          </p>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-gray-700">Job site</label>
              <select required className="input mt-1" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">Select a site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Checklist template</label>
              <select required className="input mt-1" value={checklistId} onChange={(e) => setChecklistId(e.target.value)}>
                <option value="">Select a checklist…</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.is_default ? '(default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={creating || !siteId || !checklistId} className="btn-primary w-full">
              {creating ? 'Starting…' : 'Start inspection'}
            </button>
          </>
        )}
      </form>
    </DashboardShell>
  );
}
