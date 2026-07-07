'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import type { Company } from '@/lib/types';

export default function SettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetch('/api/companies')
      .then((r) => r.json())
      .then((data) => {
        setCompany(data.company || null);
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch('/api/companies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: company.name,
        contact_email: company.contact_email,
        phone: company.phone,
        address: company.address,
      }),
    });
    setSaving(false);
    setMessage(res.ok ? 'Saved.' : 'Failed to save changes.');
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'company-logos');
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    setUploadingLogo(false);
    if (!res.ok) {
      setMessage(data.error || 'Logo upload failed');
      return;
    }
    await fetch('/api/companies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: data.url }),
    });
    setCompany({ ...company, logo_url: data.url });
  }

  async function handleManageBilling() {
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  if (loading || !company) {
    return (
      <DashboardShell>
        <p className="text-sm text-gray-400">Loading…</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSave} className="card space-y-4">
          <h2 className="font-semibold">Company Profile</h2>
          {message && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</div>}

          <div className="flex items-center gap-4">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt="Company logo" className="h-16 w-16 rounded-lg border border-gray-200 object-contain" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
                No logo
              </div>
            )}
            <label className="btn-secondary cursor-pointer">
              {uploadingLogo ? 'Uploading…' : 'Upload logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Company name</label>
            <input className="input mt-1" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Contact email</label>
            <input className="input mt-1" value={company.contact_email} onChange={(e) => setCompany({ ...company, contact_email: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Phone</label>
            <input className="input mt-1" value={company.phone || ''} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Address</label>
            <input className="input mt-1" value={company.address || ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <div className="card">
          <h2 className="font-semibold">Billing</h2>
          <p className="mt-1 text-sm text-gray-500">
            Status: <span className="font-medium capitalize">{company.subscription_status}</span>
            {company.subscription_status === 'trial' && ` — trial ends ${new Date(company.trial_ends_at).toLocaleDateString()}`}
          </p>
          <button onClick={handleManageBilling} className="btn-primary mt-4">
            {company.subscription_status === 'active' ? 'Manage subscription' : 'Upgrade to paid plan — $100/mo'}
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
