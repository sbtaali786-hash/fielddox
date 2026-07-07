-- ============================================================================
-- FieldDocs — Production Database Schema
-- Target: Supabase (PostgreSQL 15+)
-- ============================================================================
-- NOTE ON THE ORIGINAL SPEC: the draft schema only defined SELECT policies.
-- Without INSERT/UPDATE/DELETE policies, RLS silently blocks all writes once
-- enabled (safe but broken), OR — if a service-role key is used everywhere
-- to work around that — it defeats RLS entirely (broken and unsafe). Both
-- failure modes show up in production, not in dev. This version defines
-- explicit policies per operation and per role.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Companies (tenants)
-- ----------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_email text not null,
  phone text,
  logo_url text,
  address text,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial','active','past_due','canceled')),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Users (profile row mirrors auth.users, adds tenant + role)
-- ----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'worker' check (role in ('admin','supervisor','worker')),
  invited_by uuid references public.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index users_company_id_idx on public.users(company_id);

-- ----------------------------------------------------------------------------
-- Sites
-- ----------------------------------------------------------------------------
create table public.sites (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  status text not null default 'active' check (status in ('active','completed','on-hold')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index sites_company_id_idx on public.sites(company_id);

-- Which workers are assigned to which sites (needed for "Worker: view assigned
-- checklists only" from the spec — the draft schema had no table for this,
-- so that access rule was unenforceable as written).
create table public.site_assignments (
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (site_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Checklist templates
-- ----------------------------------------------------------------------------
create table public.checklists (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  -- items: [{ id: "itm_1", text: "Guardrails installed on all open sides", required: true, category: "Fall Protection" }]
  items jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index checklists_company_id_idx on public.checklists(company_id);

-- ----------------------------------------------------------------------------
-- Inspections
-- ----------------------------------------------------------------------------
create table public.inspections (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade, -- denormalized for fast RLS + reporting
  inspector_id uuid references public.users(id) on delete set null,
  checklist_id uuid references public.checklists(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','completed','signed')),
  -- responses: [{ item_id, answer: "yes"|"no"|"na", note, photo_url }]
  responses jsonb not null default '[]'::jsonb,
  gps_lat double precision,
  gps_lng double precision,
  inspector_signature_url text,
  site_manager_signature_url text,
  report_pdf_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inspections_site_id_idx on public.inspections(site_id);
create index inspections_company_id_idx on public.inspections(company_id);
create index inspections_status_idx on public.inspections(status);

-- ----------------------------------------------------------------------------
-- Compliance items (licenses, training, insurance)
-- ----------------------------------------------------------------------------
create table public.compliance (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in ('license','training','insurance')),
  name text not null,
  expiry_date date not null,
  reminder_days integer not null default 30,
  last_reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index compliance_company_id_idx on public.compliance(company_id);
create index compliance_expiry_idx on public.compliance(expiry_date);

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, used inside RLS policies)
-- Written as functions rather than inline subqueries so every policy stays
-- consistent and the query planner can cache the lookup per statement.
-- ----------------------------------------------------------------------------
create or replace function public.current_company_id()
returns uuid
language sql
security definer
stable
as $$
  select company_id from public.users where id = auth.uid();
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin_or_supervisor()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select role in ('admin','supervisor') from public.users where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- Auto-create user profile row on signup
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, full_name, company_id, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    (new.raw_user_meta_data->>'company_id')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'worker')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at before update on public.companies
  for each row execute procedure public.set_updated_at();
create trigger inspections_set_updated_at before update on public.inspections
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;
alter table public.checklists enable row level security;
alter table public.inspections enable row level security;
alter table public.compliance enable row level security;

-- Companies: members can read their own tenant; only admins can update it.
create policy "select_own_company" on public.companies
  for select using (id = public.current_company_id());

create policy "update_own_company_admin" on public.companies
  for update using (id = public.current_company_id() and public.current_role() = 'admin');

-- Users: members can see teammates; only admins can invite/edit/remove.
create policy "select_company_members" on public.users
  for select using (company_id = public.current_company_id());

create policy "admin_insert_users" on public.users
  for insert with check (company_id = public.current_company_id() and public.current_role() = 'admin');

create policy "admin_update_users" on public.users
  for update using (company_id = public.current_company_id() and public.current_role() = 'admin');

create policy "admin_delete_users" on public.users
  for delete using (company_id = public.current_company_id() and public.current_role() = 'admin'
                     and id <> auth.uid()); -- admins can't delete themselves via API

-- Sites: everyone in the company can read; admin/supervisor can write.
create policy "select_company_sites" on public.sites
  for select using (company_id = public.current_company_id());

create policy "write_company_sites_insert" on public.sites
  for insert with check (company_id = public.current_company_id() and public.is_admin_or_supervisor());

create policy "write_company_sites_update" on public.sites
  for update using (company_id = public.current_company_id() and public.is_admin_or_supervisor());

-- Site assignments: readable by company; writable by admin/supervisor.
create policy "select_site_assignments" on public.site_assignments
  for select using (
    site_id in (select id from public.sites where company_id = public.current_company_id())
  );

create policy "write_site_assignments" on public.site_assignments
  for insert with check (
    public.is_admin_or_supervisor()
    and site_id in (select id from public.sites where company_id = public.current_company_id())
  );

create policy "delete_site_assignments" on public.site_assignments
  for delete using (
    public.is_admin_or_supervisor()
    and site_id in (select id from public.sites where company_id = public.current_company_id())
  );

-- Checklists: company-readable; admin/supervisor writable.
create policy "select_company_checklists" on public.checklists
  for select using (company_id = public.current_company_id());

create policy "write_company_checklists_insert" on public.checklists
  for insert with check (company_id = public.current_company_id() and public.is_admin_or_supervisor());

create policy "write_company_checklists_update" on public.checklists
  for update using (company_id = public.current_company_id() and public.is_admin_or_supervisor());

-- Inspections: admins/supervisors see all company inspections; workers see
-- only inspections on sites they're assigned to (this enforces the "Worker:
-- view assigned checklists only" rule from the spec, which the draft schema
-- described in prose but never encoded).
create policy "select_inspections" on public.inspections
  for select using (
    company_id = public.current_company_id()
    and (
      public.is_admin_or_supervisor()
      or site_id in (select site_id from public.site_assignments where user_id = auth.uid())
    )
  );

create policy "insert_inspections" on public.inspections
  for insert with check (
    company_id = public.current_company_id()
    and (
      public.is_admin_or_supervisor()
      or site_id in (select site_id from public.site_assignments where user_id = auth.uid())
    )
  );

create policy "update_inspections" on public.inspections
  for update using (
    company_id = public.current_company_id()
    and (
      public.is_admin_or_supervisor()
      or (inspector_id = auth.uid() and status = 'draft') -- workers can only edit their own drafts
    )
  );

-- Compliance: company-readable; admin-only writable (licenses/insurance are
-- an admin liability concern, not something a worker role should edit).
create policy "select_company_compliance" on public.compliance
  for select using (company_id = public.current_company_id());

create policy "admin_write_compliance_insert" on public.compliance
  for insert with check (company_id = public.current_company_id() and public.current_role() = 'admin');

create policy "admin_write_compliance_update" on public.compliance
  for update using (company_id = public.current_company_id() and public.current_role() = 'admin');

create policy "admin_write_compliance_delete" on public.compliance
  for delete using (company_id = public.current_company_id() and public.current_role() = 'admin');

-- ============================================================================
-- Storage buckets + policies (photos, signatures, PDFs, logos)
-- Run this in the SQL editor too — bucket creation via SQL requires the
-- storage extension, which Supabase enables by default.
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('inspection-photos', 'inspection-photos', false),
  ('signatures', 'signatures', false),
  ('reports', 'reports', false),
  ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

-- Path convention enforced by the app: {company_id}/{...}. Policies check
-- the first path segment against the caller's company_id so one tenant can
-- never read or write another tenant's files, even with a guessed URL.
create policy "tenant_read_photos" on storage.objects for select
  using (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = public.current_company_id()::text);
create policy "tenant_write_photos" on storage.objects for insert
  with check (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy "tenant_read_signatures" on storage.objects for select
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = public.current_company_id()::text);
create policy "tenant_write_signatures" on storage.objects for insert
  with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy "tenant_read_reports" on storage.objects for select
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = public.current_company_id()::text);
create policy "tenant_write_reports" on storage.objects for insert
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy "public_read_logos" on storage.objects for select
  using (bucket_id = 'company-logos');
create policy "tenant_write_logos" on storage.objects for insert
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = public.current_company_id()::text);

-- ============================================================================
-- Seed: default OSHA-aligned checklist template (attached per-company on signup,
-- see /api/companies POST handler)
-- ============================================================================
-- Intentionally left as application logic (src/lib/defaultChecklist.ts) rather
-- than a global seed row, because each company needs its own copy with its
-- own company_id — a shared template row would violate tenant isolation.
