import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const itemSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(500),
  category: z.string().min(1).max(100),
  required: z.boolean(),
});

const createChecklistSchema = z.object({
  name: z.string().min(1).max(200),
  items: z.array(itemSchema).min(1),
  is_default: z.boolean().optional(),
});

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('checklists').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checklists: data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single();
  if (!profile?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 404 });
  if (profile.role === 'worker') {
    return NextResponse.json({ error: 'Workers cannot create checklists' }, { status: 403 });
  }

  const parsed = createChecklistSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only one default checklist per company — unset any existing default first.
  if (parsed.data.is_default) {
    await supabase.from('checklists').update({ is_default: false }).eq('company_id', profile.company_id);
  }

  const { data, error } = await supabase
    .from('checklists')
    .insert({ ...parsed.data, company_id: profile.company_id, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checklist: data }, { status: 201 });
}
