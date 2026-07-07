# FieldDocs

Digital safety & compliance app for construction contractors. Replaces paper checklists with mobile-friendly digital inspections, one-click PDF reports, and automated compliance reminders.

## Stack
Next.js 14 (App Router) · Supabase (Postgres + Auth + Storage) · Stripe · Resend · Tailwind CSS · @react-pdf/renderer

## 1. Supabase setup
1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql` in full. It creates all tables, RLS policies, storage buckets, and storage policies.
3. In **Authentication → Providers**, enable Email (magic link + password).
4. In **Authentication → URL Configuration**, set the Site URL to your deployed app URL, and add `http://localhost:3000/api/auth/callback` as a redirect URL for local dev.
5. Copy your Project URL, anon key, and service role key from **Settings → API**.

## 2. Stripe setup
1. Create a product ("FieldDocs Monthly") with a recurring $100/month price. Copy the price ID.
2. Create a webhook endpoint pointing to `https://your-domain.com/api/stripe/webhook`, subscribed to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy the signing secret.
3. For local testing, use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## 3. Resend setup
1. Create an account at resend.com, verify a sending domain.
2. Copy your API key.

## 4. Environment variables
Copy `.env.local.example` to `.env.local` and fill in all values from steps 1–3.

## 5. Install and run locally
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`.

## 6. Deploy to Vercel
```bash
vercel
```
Add all `.env.local` variables to the Vercel project's Environment Variables settings. `vercel.json` already configures the daily compliance-reminder cron — Vercel Cron requires a paid plan for anything more frequent than once/day on Hobby, so the schedule here (`0 13 * * *`, 1pm UTC daily) works on Hobby.

## Architecture notes (read before extending)

- **Multi-tenancy is enforced at the database layer**, not just in the UI. Every table has RLS policies keyed off `current_company_id()`; a bug in an API route can't leak another company's data because Postgres itself blocks the query. Only two routes use the service-role key (bypassing RLS): the Stripe webhook (no user session exists) and company creation during onboarding (user has no `company_id` yet) — both are scoped by IDs from trusted sources (Stripe metadata, the caller's own auth session), never from arbitrary request input.
- **Role enforcement**: `admin` > `supervisor` > `worker`. Workers can only see/edit inspections on sites they're assigned to (`site_assignments` table) and can't edit their own inspection once it leaves `draft` status — this is enforced in RLS, not just hidden in the UI, so it holds even if someone calls the API directly.
- **Storage paths are tenant-prefixed** (`{company_id}/...`) and storage RLS policies check that prefix against the caller's own company — this closes the common "guessable Supabase Storage URL" leak.
- **Signed URLs for reports/photos expire** (7–30 days). If you need permanent access, either move those buckets to `public: true` (loses per-tenant access control unless you keep obscure paths) or add a route that re-signs a URL on demand rather than storing the signed URL as if it were permanent.

## What's still a placeholder / needs your judgment before going to production

- **Checklist content**: `src/lib/defaultChecklist.ts` is a reasonable general-construction starting point, not a compliance guarantee. Don't market it as "OSHA certified" — it isn't a certification, it's a checklist. Get a safety consultant or your insurer to review before customers rely on it.
- **Stripe customer portal**: checkout is wired up; a "manage payment method / cancel" self-service portal link (`stripe.billingPortal.sessions.create`) is a 10-line addition once you've configured the portal in the Stripe dashboard.
- **Password reset flow**: not included — add a `/forgot-password` page using `supabase.auth.resetPasswordForEmail`.
- **Rate limiting**: none of the API routes are rate-limited. Add this at the Vercel edge (e.g. `@upstash/ratelimit`) before opening signups publicly, especially on `/api/upload` and `/api/team` (invite spam).
- **No automated tests.** Given this handles safety/compliance records with legal weight, add integration tests for the RLS policies specifically (a wrong policy fails silently, not loudly) before onboarding real customers.
