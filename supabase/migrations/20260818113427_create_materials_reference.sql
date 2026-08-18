create table public.materials_reference (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    unit text not null,
    unit_price double precision not null,
    region text,
    category text,

    constraint materials_reference_name_region_unique
        unique (name, region)
);