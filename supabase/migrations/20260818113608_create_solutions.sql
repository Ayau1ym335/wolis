create type public.solution_type as enum (
    'low_cost',
    'optimal',
    'eco'
);

create table public.solutions (
    id uuid primary key default gen_random_uuid(),
    assessment_id uuid not null
        references public.assessments(id)
        on delete cascade,

    type public.solution_type not null,
    required_changes text not null,
    cost_amount double precision not null,
    cost_currency text not null,
    savings_money double precision,
    savings_resources_description text,
    created_at timestamptz not null default now(),

    constraint solutions_assessment_type_unique
        unique (assessment_id, type)
);