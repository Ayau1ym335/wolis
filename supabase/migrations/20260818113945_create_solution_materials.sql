create table public.solution_materials (
    id uuid primary key default gen_random_uuid(),
    solution_id uuid not null
        references public.solutions(id)
        on delete cascade,

    material_id uuid not null
        references public.materials_reference(id)
        on delete restrict,

    quantity double precision not null,
    unit_price_at_calculation double precision not null,

    constraint solution_materials_solution_material_unique
        unique (solution_id, material_id)
);