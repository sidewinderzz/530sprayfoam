-- 530 Spray Foam — initial schema.
-- Applied automatically by Netlify before a deploy is published.

create table if not exists content (
  id         smallint primary key default 1,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint content_single_row check (id = 1)
);

insert into content (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

create table if not exists leads (
  id            bigserial primary key,
  ref           text unique not null,
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
  consent       boolean not null default false,
  estimate      jsonb,
  status        text not null default 'new',
  read          boolean not null default false,
  source        text not null default 'website'
);

create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_status_idx  on leads (status);

-- login throttling, so the short passcode cannot be brute forced
create table if not exists login_attempts (
  id bigserial primary key,
  at timestamptz not null default now(),
  ip text not null,
  ok boolean not null default false
);

create index if not exists login_attempts_ip_at_idx on login_attempts (ip, at desc);
