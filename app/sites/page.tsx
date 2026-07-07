'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, MapPin } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import type { Site } from '@/lib/types';

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });
  const [error, setError] = useState<string | null>(null);

  async function loadSites() {
    setLoading(true);
    const res = await fetch('/api/sites');
    const data = await res.json();
    setSites(data.sites || []);
    setLoading(false);
  }

  useEffect(() => {
    loadSites();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Failed to create site');
      return;
    }
    setForm({ name: '', address: '' });
    setShowForm(false);
    loadSites();
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sites</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" /> Add Site
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mt-4 space-y-4">
          {error && <div className="rounded-lg bg-status-red/10 px-3 py-2 text-sm text-status-red">{error}</div>}
          <div>
            <label className="text-sm font-medium text-gray-700">Site name</label>
            <input required className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Address</label>
            <input className="input mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary">
            Save site
          </button>
        </form>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : sites.length === 0 ? (
          <p className="text-sm text-gray-400">No sites yet. Add your first one above.</p>
        ) : (
          sites.map((site) => (
            <Link key={site.id} href={`/inspections?site_id=${site.id}`} className="card hover:border-brand-300">
              <div className="flex items-start justify-between">
                <MapPin className="h-5 w-5 text-brand-600" />
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    site.status === 'active'
                      ? 'bg-status-green/10 text-status-green'
                      : site.status === 'on-hold'
                      ? 'bg-status-yellow/10 text-status-yellow'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {site.status}
                </span>
              </div>
              <div className="mt-3 font-semibold">{site.name}</div>
              <div className="text-sm text-gray-500">{site.address || 'No address on file'}</div>
            </Link>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
