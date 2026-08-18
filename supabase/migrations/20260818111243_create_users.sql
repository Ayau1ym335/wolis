create table public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);