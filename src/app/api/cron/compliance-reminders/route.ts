import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Triggered by Vercel Cron (see vercel.json) once daily. Protected by a
 * shared secret rather than user auth, since there's no logged-in user in
 * a cron context — CRON_SECRET must be set to a long random value and never
 * reused from any other credential.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Pull every compliance item expiring in the next 60 days — wide enough to
  // cover any reminder_days value up to 60; items with longer lead times are
  // simply skipped by the per-item check below.
  const horizon = addDays(new Date(), 60).toISOString().slice(0, 10);
  const { data: items, error } = await supabase
    .from('compliance')
    .select('*, companies(name, contact_email)')
    .lte('expiry_date', horizon);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const item of items || []) {
    const daysUntilExpiry = differenceInCalendarDays(parseISO(item.expiry_date), new Date());
    const shouldRemind = daysUntilExpiry <= item.reminder_days && daysUntilExpiry >= 0;
    const alreadyRemindedToday =
      item.last_reminder_sent_at && differenceInCalendarDays(new Date(), parseISO(item.last_reminder_sent_at)) < 1;

    if (!shouldRemind || alreadyRemindedToday) continue;

    const company = (item as any).companies;
    if (!company?.contact_email) continue;

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'alerts@fielddocs.app',
        to: company.contact_email,
        subject: `Compliance alert: ${item.name} expires in ${daysUntilExpiry} day(s)`,
        html: `<p>Your <strong>${item.type}</strong> "<strong>${item.name}</strong>" expires on ${item.expiry_date} (${daysUntilExpiry} day(s) from today).</p><p>Log in to FieldDocs to update it before it lapses.</p>`,
      });
      await supabase.from('compliance').update({ last_reminder_sent_at: new Date().toISOString() }).eq('id', item.id);
      sent++;
    } catch (err) {
      console.error(`Failed to send compliance reminder for ${item.id}`, err);
    }
  }

  return NextResponse.json({ checked: items?.length || 0, sent });
}
