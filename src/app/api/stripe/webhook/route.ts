import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';

// Webhooks must read the raw, unparsed body — Stripe signs the exact bytes
// it sent, and any JSON re-serialization (even whitespace differences) will
// break signature verification. Next.js route handlers give raw access via
// request.text(), so no special config is needed here (unlike the old Pages Router).
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Service-role client: this route runs with no authenticated user (Stripe
  // is the caller), so it must bypass RLS — but every write below is scoped
  // by company_id derived from Stripe metadata, never from client input.
  const supabase = createServiceRoleClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.company_id;
      if (companyId) {
        await supabase
          .from('companies')
          .update({
            subscription_status: 'active',
            stripe_subscription_id: session.subscription as string,
          })
          .eq('id', companyId);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = subscription.metadata?.company_id;
      if (companyId) {
        const status = subscription.status === 'active' ? 'active' : subscription.status === 'past_due' ? 'past_due' : 'canceled';
        await supabase.from('companies').update({ subscription_status: status }).eq('id', companyId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = subscription.metadata?.company_id;
      if (companyId) {
        await supabase.from('companies').update({ subscription_status: 'canceled' }).eq('id', companyId);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await supabase.from('companies').update({ subscription_status: 'past_due' }).eq('stripe_customer_id', customerId);
      break;
    }

    default:
      // Unhandled event types are expected and fine to ignore — Stripe sends
      // far more event types than this app needs to act on.
      break;
  }

  return NextResponse.json({ received: true });
}
