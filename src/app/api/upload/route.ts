import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_BUCKETS = ['inspection-photos', 'signatures', 'company-logos'] as const;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for field photos, blocks accidental video uploads
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single();
  if (!profile?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file');
  const bucket = formData.get('bucket');

  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (typeof bucket !== 'string' || !ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number])) {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 8MB limit' }, { status: 400 });
  }

  // Path is always {company_id}/{uuid}.{ext} — this convention is what the
  // storage RLS policies in schema.sql check against, so a tenant can never
  // read or overwrite another tenant's files regardless of client input.
  const ext = file.type.split('/')[1];
  const path = `${profile.company_id}/${uuidv4()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const isPublicBucket = bucket === 'company-logos';
  if (isPublicBucket) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, path });
  }

  const { data: signedUrl, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 30); // 30-day signed URL, refreshed on report regeneration
  if (signError) return NextResponse.json({ error: signError.message }, { status: 500 });

  return NextResponse.json({ url: signedUrl.signedUrl, path });
}
