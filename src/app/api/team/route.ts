import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
  role: z.enum(['admin', 'supervisor', 'worker']),
});

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 });
  }

  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Inviting a user creates their auth.users row via the admin API (service role,
  // required since this isn't a self-signup flow) and sends them a magic link.
  // The `handle_new_user` trigger reads company_id/role out of raw_user_meta_data.
  const admin = createServiceRoleClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      full_name: parsed.data.full_name,
      company_id: profile.company_id,
      role: parsed.data.role,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
  });

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: company } = await supabase.from('companies').select('name').eq('id', profile.company_id).single();
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'alerts@fielddocs.app',
      to: parsed.data.email,
      subject: `You've been invited to ${company?.name || 'FieldDocs'}`,
      html: `<p>Hi ${parsed.data.full_name},</p><p>You've been added to ${company?.name || 'a FieldDocs workspace'} as a <strong>${parsed.data.role}</strong>. Check your email for a separate sign-in link from Supabase to set up your account.</p>`,
    });
  }

  return NextResponse.json({ user: invited.user }, { status: 201 });
}
