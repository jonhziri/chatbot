create table if not exists public.bot_config (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chats (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id text primary key,
  chat_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_entries (
  id text primary key,
  question text,
  category text,
  keywords text[] default '{}',
  source_chat_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_updated_at_idx on public.chats (updated_at desc);
create index if not exists leads_chat_id_idx on public.leads (chat_id);
create index if not exists training_entries_updated_at_idx on public.training_entries (updated_at desc);
create index if not exists training_entries_category_idx on public.training_entries (category);

alter table public.bot_config enable row level security;
alter table public.chats enable row level security;
alter table public.leads enable row level security;
alter table public.training_entries enable row level security;
