'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CHECKLIST_ITEMS } from '@/lib/defaultChecklist';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: '', fullName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Create the company row first (no auth required — public insert is
      // intentionally NOT allowed by RLS, so this must go through a route
      // that uses the service role... but for signup specifically we let the
      // client create the auth user first, then create the company via the
      // trigger's metadata, avoiding a chicken-and-egg RLS problem entirely.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.fullName, role: 'admin' },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?redirectTo=/onboarding`,
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup did not return a user');

      // 2. Create the company now that we have an authenticated session,
      // then attach it + a default checklist. RLS allows this because the
      // company doesn't exist yet on the users row — we do it via a
      // dedicated onboarding server action instead of direct table access
      // to keep this atomic. See /onboarding for the completion step.
      sessionStorage.setItem(
        'fielddocs_pending_company',
        JSON.stringify({ name: form.companyName, contact_email: form.email })
      );

      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="text-xl font-bold">Start your free trial</h1>
          <p className="mt-1 text-sm text-gray-500">14 days free. No credit card required.</p>

          {error && <div className="mt-4 rounded-lg bg-status-red/10 px-3 py-2 text-sm text-status-red">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Company name</label>
              <input
                required
                className="input mt-1"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Summit Roofing Co."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Your full name</label>
              <input
                required
                className="input mt-1"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Jamie Rivera"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                required
                type="email"
                className="input mt-1"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jamie@summitroofing.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Password</label>
              <input
                required
                minLength={8}
                type="password"
                className="input mt-1"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-600">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
