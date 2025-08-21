-- ALTER EXISTING TABLES
ALTER TABLE public.order_teams DROP COLUMN IF EXISTS packers_json;

ALTER TABLE public.materials
    ADD COLUMN unit_id uuid REFERENCES public.units_of_measure(id);

ALTER TABLE public.task_logs
DROP CONSTRAINT IF EXISTS fk_task_logs_order_package_id;

ALTER TABLE public.task_logs
    DROP COLUMN IF EXISTS packer_id CASCADE,
    DROP COLUMN IF EXISTS order_package_id;

-- order to packer - linking

CREATE TABLE public.order_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.order(id) ON DELETE CASCADE,
    packer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (order_team_id, packer_id)
);

-- New Supplier Table

CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    address text,
    other_info text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MATERIAL TYPES

CREATE TYPE material_type AS ENUM ('standard', 'dimensional', 'gas');
CREATE TABLE public.order_package_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_package_id UUID NOT NULL REFERENCES public.order_packages(id) ON DELETE CASCADE,
    material_variant_id UUID NOT NULL REFERENCES public.material_variants(id) ON DELETE CASCADE,
    material_type material_type NOT NULL, -- 'standard', 'dimensional', 'gas'
    is_final BOOLEAN NOT NULL DEFAULT FALSE, -- is this the final value?
    quantity numeric NOT NULL CHECK (quantity >= 0),
    unit_id UUID NOT NULL REFERENCES public.units_of_measure(id) ON DELETE RESTRICT,
    length numeric,
    width numeric,
    height numeric,
    qty_of_cylinder numeric,
    qty_of_gas_used numeric,
    comment text,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasko relatedo
CREATE TABLE public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.task_logs(id) ON DELETE CASCADE,
    packer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (task_id, packer_id)
);

-- Index for faster lookups
CREATE INDEX idx_task_assignments_task_id ON public.task_assignments(task_id);
CREATE INDEX idx_task_assignments_packer_id ON public.task_assignments(packer_id);

CREATE TABLE public.task_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.task_logs(id) ON DELETE CASCADE,
    order_package_id UUID NOT NULL REFERENCES public.order_packages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (task_id, order_package_id)
);

-- Index for faster lookups
CREATE INDEX idx_task_packages_task_id ON public.task_packages(task_id);
CREATE INDEX idx_task_packages_order_package_id ON public.task_packages(order_package_id);



-- SERVICES
CREATE TABLE public.services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service text NOT NULL,
    tag_id uuid NOT NULL REFERENCES public.tags(id)
);

CREATE TABLE public.order_package_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_package_id UUID NOT NULL REFERENCES public.order_packages(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PACKAGE DIMENSIONS / INFO

CREATE TABLE public.package_info (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Internal dimensions of the box
    internal_length numeric,
    internal_width numeric,
    internal_height numeric,
    
    -- External dimensions of the box
    external_length numeric,
    external_width numeric,
    external_height numeric,

    center_of_gravity boolean,
    quantity int,
    box_type_id uuid NOT NULL REFERENCES public.materials(id),
    packing_type_id uuid NOT NULL REFERENCES public.packing_types(id),
    tare numeric,
    net_weight numeric,
    gross_weight numeric
);

CREATE TABLE public.package_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_package_id uuid NOT NULL REFERENCES public.order_packages(id),
    quantity int,
    designation varchar,
    dimensions jsonb
);

-- BEAMS / SECURING
CREATE TABLE public.beam (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quantity numeric,
    type uuid REFERENCES public.materials(id),
    width numeric,
    thickness numeric,
    space numeric
);

CREATE TABLE public.securing_template (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quantity int,
    type_id uuid REFERENCES public.materials(id),
    thickness numeric,
    horizontal_bar uuid REFERENCES public.beam(id),
    vertical_bar uuid REFERENCES public.beam(id),
    skids int
);

-- Create the ENUM type for the sides of the package
CREATE TYPE public.securing_side AS ENUM ('big_sides', 'small_sides', 'lid', 'base');
CREATE TABLE public.order_package_securing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_package_id UUID NOT NULL REFERENCES public.order_packages(id) ON DELETE CASCADE,
    securing_template_id UUID NOT NULL REFERENCES public.securing_template(id) ON DELETE RESTRICT,
    securing_side public.securing_side NOT NULL,
    is_final BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (order_package_id, securing_side, is_final)
);

-- This table will store all images and their associated data.
CREATE TABLE public.media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.order_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    UNIQUE (order_id, media_id)
);

CREATE TABLE public.task_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.task_logs(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    UNIQUE (task_id, media_id)
);

CREATE TABLE public.order_package_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_package_id UUID NOT NULL REFERENCES public.order_packages(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    UNIQUE (order_package_id, media_id)
);

CREATE TABLE public.securing_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    securing_id UUID NOT NULL REFERENCES public.order_package_securing(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    UNIQUE (securing_id, media_id)
);

CREATE TABLE public.service_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.order_package_services(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    UNIQUE (service_id, media_id)
);

---------------------------------------------------------------------------

ALTER TABLE public.order_packages
    ADD COLUMN original_pkg_info uuid REFERENCES public.package_info(id),
    ADD COLUMN final_pkg_info uuid REFERENCES public.package_info(id),
    DROP COLUMN IF EXISTS packing_type_id,
    DROP COLUMN IF EXISTS equipment_original_dimensions,
    DROP COLUMN IF EXISTS equipment_final_dimensions,
    DROP COLUMN IF EXISTS equipment_original_net_weight_kg,
    DROP COLUMN IF EXISTS equipment_final_net_weight_kg,
    DROP COLUMN IF EXISTS box_internal_original_dimensions,
    DROP COLUMN IF EXISTS box_internal_final_dimensions,
    DROP COLUMN IF EXISTS box_external_original_dimensions,
    DROP COLUMN IF EXISTS box_external_final_dimensions;
