-- ═══════════════════════════════════════════════════════════
-- 530 Spray Foam — schema
--
-- Three things live here:
--   content  a single row of site copy, edited in the admin
--   leads    quote-form submissions
--   photos   storage bucket for job photos
--
-- Row Level Security is on for everything. The public (anon key)
-- can read content and insert a lead — nothing else. Reading or
-- changing anything requires a real signed-in session.
-- ═══════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── content ────────────────────────────────────────────────
create table if not exists public.content (
  id         smallint primary key default 1,
  data       jsonb    not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint content_single_row check (id = 1)
);

alter table public.content enable row level security;

-- anyone may read the site copy; that is the public website
drop policy if exists content_public_read on public.content;
create policy content_public_read
  on public.content for select
  to anon, authenticated
  using (true);

-- only a signed-in crew member may change it
drop policy if exists content_crew_write on public.content;
create policy content_crew_write
  on public.content for all
  to authenticated
  using (true)
  with check (true);

-- ── leads ──────────────────────────────────────────────────
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique not null default 'SF-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)),
  created_at    timestamptz not null default now(),
  name          text not null,
  phone         text not null,
  email         text,
  city          text,
  zip           text,
  sqft          integer,
  building_type text,
  areas         jsonb default '[]'::jsonb,
  timeline      text,
  notes         text,
  consent       boolean default false,
  estimate      jsonb,
  status        text not null default 'new'
                check (status in ('new','contacted','quoted','won','lost')),
  read          boolean not null default false,
  source        text default 'website'
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx  on public.leads (status);

alter table public.leads enable row level security;

-- the public quote form may create a lead, and nothing more.
-- It cannot read, edit or delete — a visitor must never be able
-- to enumerate other people's contact details.
drop policy if exists leads_public_insert on public.leads;
create policy leads_public_insert
  on public.leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists leads_crew_read on public.leads;
create policy leads_crew_read
  on public.leads for select
  to authenticated
  using (true);

drop policy if exists leads_crew_update on public.leads;
create policy leads_crew_update
  on public.leads for update
  to authenticated
  using (true) with check (true);

drop policy if exists leads_crew_delete on public.leads;
create policy leads_crew_delete
  on public.leads for delete
  to authenticated
  using (true);

-- keep a lead's own fields honest regardless of what the client posts
create or replace function public.leads_defaults()
returns trigger language plpgsql as $$
begin
  new.created_at := now();
  new.status     := coalesce(new.status, 'new');
  new.read       := false;
  return new;
end $$;

drop trigger if exists leads_defaults_trg on public.leads;
create trigger leads_defaults_trg
  before insert on public.leads
  for each row execute function public.leads_defaults();

-- ── storage: job photos ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists photos_public_read on storage.objects;
create policy photos_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

drop policy if exists photos_crew_write on storage.objects;
create policy photos_crew_write
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

drop policy if exists photos_crew_delete on storage.objects;
create policy photos_crew_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos');

-- ── seed the content row ───────────────────────────────────
insert into public.content (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;
