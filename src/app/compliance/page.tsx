'use client';

import { useEffect, useState } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import type { ComplianceItem, ComplianceType } from '@/lib/types';
import { complianceStatus } from '@/lib/utils';

const STATUS_DOT: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-status-green',
  yellow: 'bg-status-yellow',
  red: 'bg-status-red',
};

export default function CompliancePage() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ type: ComplianceType; name: string; expiry_date: string; reminder_days: number }>({
    type: 'license',
    name: '',
    expiry_date: '',
    reminder_days: 30,
  });
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    const res = await fetch('/api/compliance');
    const data = await res.json();
    setItems(data.compliance || []);
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Failed to save item');
      return;
    }
    setForm({ type: 'license', name: '', expiry_date: '', reminder_days: 30 });
    setShowForm(false);
    loadItems();
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Compliance</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" /> Add Item
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mt-4 grid gap-4 sm:grid-cols-2">
          {error && <div className="col-span-2 rounded-lg bg-status-red/10 px-3 py-2 text-sm text-status-red">{error}</div>}
          <div>
            <label className="text-sm font-medium text-gray-700">Type</label>
            <select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ComplianceType })}>
              <option value="license">License</option>
              <option value="training">Training</option>
              <option value="insurance">Insurance</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Name</label>
            <input required className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="General Liability Policy" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Expiry date</label>
            <input required type="date" className="input mt-1" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Remind me (days before)</label>
            <input
              type="number"
              min={1}
              max={365}
              className="input mt-1"
              value={form.reminder_days}
              onChange={(e) => setForm({ ...form, reminder_days: Number(e.target.value) })}
            />
          </div>
          <button type="submit" className="btn-primary sm:col-span-2">
            Save
          </button>
        </form>
      )}

      <div className="card mt-6 divide-y divide-gray-100">
        {loading ? (
          <p className="py-4 text-sm text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-4 text-sm text-gray-400">No compliance items tracked yet.</p>
        ) : (
          items.map((item) => {
            const status = complianceStatus(item.expiry_date, item.reminder_days);
            const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <div key={item.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs capitalize text-gray-500">{item.type}</div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{new Date(item.expiry_date).toLocaleDateString()}</div>
                  <div className={`text-xs ${daysLeft < 0 ? 'text-status-red' : 'text-gray-500'}`}>
                    {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <ShieldAlert className="h-3.5 w-3.5" /> Reminders are sent automatically by email as items approach their reminder window.
      </div>
    </DashboardShell>
  );
}
