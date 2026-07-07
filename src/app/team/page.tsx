'use client';

import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import type { AppUser, UserRole } from '@/lib/types';

export default function TeamPage() {
  const [team, setTeam] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ email: string; full_name: string; role: UserRole }>({
    email: '',
    full_name: '',
    role: 'worker',
  });
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  async function loadTeam() {
    setLoading(true);
    const res = await fetch('/api/team');
    const data = await res.json();
    setTeam(data.team || []);
    setLoading(false);
  }

  useEffect(() => {
    loadTeam();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteSent(false);
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Failed to send invite');
      return;
    }
    setInviteSent(true);
    setForm({ email: '', full_name: '', role: 'worker' });
    setShowForm(false);
    loadTeam();
  }

  const roleBadge: Record<UserRole, string> = {
    admin: 'bg-brand-500/10 text-brand-700',
    supervisor: 'bg-status-yellow/10 text-status-yellow',
    worker: 'bg-gray-100 text-gray-600',
  };

  return (
    <DashboardShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="mr-1.5 h-4 w-4" /> Invite Member
        </button>
      </div>

      {inviteSent && (
        <div className="mt-4 rounded-lg bg-status-green/10 px-3 py-2 text-sm text-status-green">
          Invite sent — they'll receive a sign-in link by email.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleInvite} className="card mt-4 space-y-4">
          {error && <div className="rounded-lg bg-status-red/10 px-3 py-2 text-sm text-status-red">{error}</div>}
          <div>
            <label className="text-sm font-medium text-gray-700">Full name</label>
            <input required className="input mt-1" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input required type="email" className="input mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <select className="input mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              <option value="worker">Worker — can view assigned checklists only</option>
              <option value="supervisor">Supervisor — can create/edit reports for their sites</option>
              <option value="admin">Admin — full access, sees all reports</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Send invite
          </button>
        </form>
      )}

      <div className="card mt-6 divide-y divide-gray-100">
        {loading ? (
          <p className="py-4 text-sm text-gray-400">Loading…</p>
        ) : team.length === 0 ? (
          <p className="py-4 text-sm text-gray-400">No team members yet.</p>
        ) : (
          team.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {(member.full_name || member.email)[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{member.full_name || member.email}</div>
                  <div className="text-xs text-gray-500">{member.email}</div>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge[member.role]}`}>{member.role}</span>
            </div>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
