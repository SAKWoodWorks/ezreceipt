create extension if not exists "pgcrypto";

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  line_display_name text,
  group_id text,
  date_on_receipt date,
  store_name text,
  items jsonb default '[]',
  total_amount numeric(10,2),
  category text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists receipts_line_user_id_idx on receipts (line_user_id);
create index if not exists receipts_status_idx on receipts (status);
create index if not exists receipts_created_at_idx on receipts (created_at desc);
