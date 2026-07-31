-- Customer-supplied photos on a lead, and the throttle that keeps the
-- public upload endpoint from being used as free image hosting.

alter table leads add column if not exists photos jsonb not null default '[]'::jsonb;

create table if not exists upload_attempts (
  id bigserial primary key,
  at timestamptz not null default now(),
  ip text not null
);

create index if not exists upload_attempts_ip_at_idx on upload_attempts (ip, at desc);
