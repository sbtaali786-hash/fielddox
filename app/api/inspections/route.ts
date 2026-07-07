import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createInspectionSchema = z.object({
  site_id: z.string().uuid(),
  checklist_id: z.string().uuid(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('site_id');
  const status = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

  // RLS on `inspections` already restricts rows to the caller's company and,
  // for workers, to their assigned sites — no need to re-derive company_id here.
  let query = supabase
    .from('inspections')
    .select('*, sites(name), users!inspections_inspector_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (siteId) query = query.eq('site_id', siteId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inspections: data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single();
  if (!profile?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 404 });

  const parsed = createInspectionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('inspections')
    .insert({
      ...parsed.data,
      company_id: profile.company_id,
      inspector_id: user.id,
      status: 'draft',
      responses: [],
    })
    .select()
    .single();

  // RLS insert policy will reject this (403-equivalent Postgres error) if a
  // worker tries to create an inspection on a site they're not assigned to.
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ inspection: data }, { status: 201 });
}
