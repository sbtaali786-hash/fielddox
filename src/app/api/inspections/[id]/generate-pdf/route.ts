import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InspectionReport } from '@/lib/pdf/InspectionReport';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single();
  if (!profile?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 404 });

  const { data: inspection, error: inspErr } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', params.id)
    .single();
  if (inspErr || !inspection) return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });

  if (!['completed', 'signed'].includes(inspection.status)) {
    return NextResponse.json({ error: 'Inspection must be completed before generating a report' }, { status: 400 });
  }

  const [{ data: company }, { data: site }, { data: checklist }, { data: inspector }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', profile.company_id).single(),
    supabase.from('sites').select('*').eq('id', inspection.site_id).single(),
    supabase.from('checklists').select('*').eq('id', inspection.checklist_id).single(),
    inspection.inspector_id
      ? supabase.from('users').select('*').eq('id', inspection.inspector_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!company || !site || !checklist) {
    return NextResponse.json({ error: 'Missing related records for report generation' }, { status: 500 });
  }

  let pdfBuffer: Buffer;
  try {
    const element = React.createElement(InspectionReport, {
      company,
      site,
      inspection,
      checklist,
      inspector: inspector ?? null,
    });
    pdfBuffer = await renderToBuffer(element as any);
  } catch (err) {
    console.error('PDF render failed', err);
    return NextResponse.json({ error: 'Failed to render PDF' }, { status: 500 });
  }

  const path = `${profile.company_id}/${inspection.id}.pdf`;
  const { error: uploadError } = await supabase.storage.from('reports').upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: signedUrl } = await supabase.storage.from('reports').createSignedUrl(path, 60 * 60 * 24 * 7);

  const { data: updated, error: updateError } = await supabase
    .from('inspections')
    .update({ report_pdf_url: signedUrl?.signedUrl })
    .eq('id', inspection.id)
    .select()
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ inspection: updated, pdf_url: signedUrl?.signedUrl });
}
