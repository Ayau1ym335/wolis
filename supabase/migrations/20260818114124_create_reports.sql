create table public.reports (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null
        references public.measurement_sessions(id)
        on delete cascade,
    storage_url text not null,
    generated_at timestamptz not null default now()
);