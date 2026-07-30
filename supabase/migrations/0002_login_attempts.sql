-- Login throttling for the crew-login edge function.
-- Written only by the function (service role); nobody else can
-- read or write it, so it cannot be used to probe for activity.

create table if not exists public.login_attempts (
  id bigserial primary key,
  at timestamptz not null default now(),
  ip text not null,
  ok boolean not null default false
);

create index if not exists login_attempts_ip_at_idx
  on public.login_attempts (ip, at desc);

alter table public.login_attempts enable row level security;
-- no policies on purpose: RLS with zero policies denies everyone.
-- The service role used by the edge function bypasses RLS.

-- housekeeping: drop rows older than a day
create or replace function public.prune_login_attempts()
returns void language sql as $$
  delete from public.login_attempts where at < now() - interval '1 day';
$$;
