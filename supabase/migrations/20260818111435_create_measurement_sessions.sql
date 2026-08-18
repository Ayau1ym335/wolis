create table public.measurement_sessions (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references public.users(id)
        on delete cascade,

    created_at timestamptz not null default now(),

    temperature_c double precision not null,
    humidity_pct double precision not null,
    pressure_hpa double precision not null,
    illuminance_lux double precision not null,
    tilt_angle_deg double precision not null,
    vibration_magnitude double precision not null,
    shock_detected boolean not null,

    building_type text not null,
    building_age_years integer not null,
    construction_material text not null,
    building_area_m2 double precision not null,
    region text not null
);