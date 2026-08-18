create table public.assessments (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null
        references public.measurement_sessions(id)
        on delete cascade,

    created_at timestamptz not null default now(),
    overall_risk_score double precision not null,
    overall_status text not null,
    confidence double precision not null,
    ml_model_used text not null,
    model_version text not null,
    parameter_flags jsonb not null default '{}'::jsonb,
    key_concerns text
);

alter table public.assessments
    add constraint assessments_session_id_unique
    unique (session_id);