import { NextResponse } from 'next/server';
import { stripe, MONTHLY_PRICE_ID } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('company_id, role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 });
  }

  const { data: company } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  // Reuse an existing Stripe customer if we already created one (e.g. a past
  // trial that canceled before converting), instead of creating a duplicate.
  let customerId = company.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: company.contact_email,
      name: company.name,
      metadata: { company_id: company.id },
    });
    customerId = customer.id;
    await supabase.from('companies').update({ stripe_customer_id: customerId }).eq('id', company.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: MONTHLY_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=canceled`,
    metadata: { company_id: company.id },
    subscription_data: { metadata: { company_id: company.id } },
  });

  return NextResponse.json({ url: session.url });
}
