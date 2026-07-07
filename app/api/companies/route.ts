import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import { DEFAULT_CHECKLIST_ITEMS } from '@/lib/defaultChecklist';
import { z } from 'zod';

const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  contact_email: z.string().email(),
});

/**
 * Company creation runs at signup, before the caller has a company_id — so
 * ordinary RLS can't authorize it (every companies policy checks
 * current_company_id(), which is null at this point). We use the service
 * role here, but only ever for THIS authenticated user's own onboarding,
 * and only once: if they already have a company_id, we reject instead of
 * silently creating a second orphaned company.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existingProfile } = await supabase.from('users').select('company_id').eq('id', user.id).single();
  if (existingProfile?.company_id) {
    return NextResponse.json({ error: 'Company already exists for this account' }, { status: 409 });
  }

  const parsed = createCompanySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createServiceRoleClient();

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert(parsed.data)
    .select()
    .single();
  if (companyError) return NextResponse.json({ error: companyError.message }, { status: 500 });

  const { error: userError } = await admin
    .from('users')
    .update({ company_id: company.id, role: 'admin' })
    .eq('id', user.id);
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  const { error: checklistError } = await admin.from('checklists').insert({
    company_id: company.id,
    name: 'Standard Site Safety Checklist',
    items: DEFAULT_CHECKLIST_ITEMS,
    is_default: true,
    created_by: user.id,
  });
  if (checklistError) console.error('Failed to seed default checklist', checklistError);

  return NextResponse.json({ company }, { status: 201 });
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single();
  if (!profile?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 404 });

  const { data, error } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ company: data });
}

export async function PUT(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can update company settings' }, { status: 403 });
  }

  const body = await request.json();
  const allowedFields = ['name', 'contact_email', 'phone', 'address', 'logo_url'];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', profile.company_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: data });
}
