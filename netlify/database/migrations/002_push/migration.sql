-- Devices that have asked to be alerted when a lead arrives.
-- One row per browser/device that granted notification permission.

create table if not exists push_subscriptions (
  id         bigserial primary key,
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  label      text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  failures   smallint not null default 0
);

create index if not exists push_subs_created_idx on push_subscriptions (created_at desc);
