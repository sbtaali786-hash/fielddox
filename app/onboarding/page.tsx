'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_CHECKLIST_ITEMS } from '@/lib/defaultChecklist';

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');

  // Step 1 runs automatically: finalize the company record that signup staged
  // in sessionStorage, now that the user has a verified auth session.
  useEffect(() => {
    async function createCompany() {
      const pending = sessionStorage.getItem('fielddocs_pending_company');
      if (!pending) {
        setStep(2); // Already created (e.g. user refreshed mid-flow) — skip ahead.
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: pending,
        });
        const data = await res.json();
        if (!res.ok) {
          // 409 means it's already been created in a previous attempt — fine, continue.
          if (res.status !== 409) throw new Error(data.error || 'Failed to create company');
        }
        sessionStorage.removeItem('fielddocs_pending_company');
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }
    createCompany();
  }, []);

  async function handleCreateSite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: siteName, address: siteAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create site');
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-1.5 w-10 rounded-full ${s <= step ? 'bg-brand-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="card">
          {error && <div className="mb-4 rounded-lg bg-status-red/10 px-3 py-2 text-sm text-status-red">{error}</div>}

          {step <= 2 && (
            <div className="py-8 text-center">
              <h1 className="text-lg font-bold">Setting up your workspace…</h1>
              <p className="mt-2 text-sm text-gray-500">
                {loading ? 'Creating your company and default checklist.' : 'Ready — let’s add your first job site.'}
              </p>
              {!loading && (
                <button onClick={() => setStep(3)} className="btn-primary mt-6">
                  Continue
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-lg font-bold">Add your first job site</h1>
              <p className="mt-1 text-sm text-gray-500">You can add more sites anytime from the Sites page.</p>
              <form onSubmit={handleCreateSite} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Site name</label>
                  <input required className="input mt-1" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="123 Main St Reroof" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Address (optional)</label>
                  <input className="input mt-1" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="123 Main St, Austin, TX" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Saving…' : 'Create site'}
                </button>
              </form>
            </div>
          )}

          {step === 4 && (
            <div>
              <h1 className="text-lg font-bold">Your default checklist is ready</h1>
              <p className="mt-1 text-sm text-gray-500">
                {DEFAULT_CHECKLIST_ITEMS.length} OSHA-aligned items across {new Set(DEFAULT_CHECKLIST_ITEMS.map((i) => i.category)).size} categories. Edit it anytime in Settings.
              </p>
              <ul className="mt-4 max-h-56 space-y-1 overflow-y-auto text-sm text-gray-600">
                {DEFAULT_CHECKLIST_ITEMS.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> {item.text}
                  </li>
                ))}
                <li className="text-gray-400">…and {DEFAULT_CHECKLIST_ITEMS.length - 6} more</li>
              </ul>
              <button onClick={() => router.push('/dashboard')} className="btn-primary mt-6 w-full">
                Go to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
