'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get('error'));
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(searchParams.get('redirectTo') || '/dashboard');
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setMagicLinkSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="text-xl font-bold">Log in to FieldDocs</h1>

          {error && <div className="mt-4 rounded-lg bg-status-red/10 px-3 py-2 text-sm text-status-red">{error}</div>}
          {magicLinkSent ? (
            <p className="mt-4 rounded-lg bg-status-green/10 px-3 py-2 text-sm text-status-green">
              Check your inbox for a sign-in link.
            </p>
          ) : (
            <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input required type="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {mode === 'password' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <input required type="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Please wait…' : mode === 'password' ? 'Log in' : 'Send magic link'}
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === 'password' ? 'magic-link' : 'password')}
                className="w-full text-center text-sm font-medium text-brand-600"
              >
                {mode === 'password' ? 'Use a magic link instead' : 'Use a password instead'}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-gray-500">
            Don’t have an account?{' '}
            <Link href="/signup" className="font-medium text-brand-600">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
