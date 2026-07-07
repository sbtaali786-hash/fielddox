import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';

const responseSchema = z.object({
  item_id: z.string(),
  answer: z.enum(['yes', 'no', 'na']),
  note: z.string().max(1000).optional(),
  photo_url: z.string().url().optional(),
});

const updateSchema = z.object({
  responses: z.array(responseSchema).optional(),
  status: z.enum(['draft', 'completed', 'signed']).optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  inspector_signature_url: z.string().url().optional(),
  site_manager_signature_url: z.string().url().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('inspections')
    .select('*, sites(name, address), checklists(name, items), users!inspections_inspector_id_fkey(full_name, email)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ inspection: data });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === 'completed' || parsed.data.status === 'signed') {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('inspections')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  // RLS update policy rejects edits to inspections that are already
  // completed/signed unless the caller is admin/supervisor — enforces the
  // "can't quietly edit a signed safety report" rule server-side, not just in the UI.
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ inspection: data });
}
