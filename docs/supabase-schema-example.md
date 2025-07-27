-- 1. public.roles (NEW TABLE for granular permissions)
-- Role: Defines user roles and their associated permissions.
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g., 'director', 'admin', 'packer', 'project_lead', 'sales'
    can_block_users BOOLEAN DEFAULT FALSE,
    can_unblock_users BOOLEAN DEFAULT FALSE,
    can_ban_users BOOLEAN DEFAULT FALSE,
    can_reset_passwords BOOLEAN DEFAULT FALSE,
    can_delete_profiles BOOLEAN DEFAULT FALSE,
    can_manage_roles BOOLEAN DEFAULT FALSE, -- Only 'director' should have this
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. public.profiles (User data, now linked to roles and with account status)
-- Role: Stores user-specific data (full name, status) linked to Supabase Auth.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Linked to Supabase Auth
    full_name TEXT NOT NULL,
    username TEXT UNIQUE, -- Added for packer login/display
    phone_number TEXT, -- Added for contact/initial password (NOT stored as plaintext password)
    role_id UUID NOT NULL REFERENCES public.roles(id), -- Link to the new roles table
    status TEXT NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'blocked'::text, 'banned'::text])), -- Account status
    packer_status TEXT DEFAULT 'available' CHECK (packer_status = ANY (ARRAY['available'::text, 'busy'::text, 'unavailable'::text])), -- Packer availability status
    current_order_id UUID REFERENCES public.orders(id), -- Track which order packer is currently working on
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. public.clients (Stores information about your clients/customers)
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. public.units_of_measure (Standardized units like m2, Pce, kg)
CREATE TABLE public.units_of_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g., 'm2', 'Pce', 'box', 'm3', 'ml', 'cm', 'kg', 'm', 'hour', 'trip'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. public.packing_types (Defines standard packing types like 4A, 4B)
CREATE TABLE public.packing_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- e.g., '4A', '4B', '4C', '1A'
    name TEXT NOT NULL, -- e.g., 'Contact Wood', 'Waterproofing', 'Gas Protection', 'Vibration Protection'
    description TEXT,
    includes_contact BOOLEAN DEFAULT FALSE,
    includes_waterproofing BOOLEAN DEFAULT FALSE,
    includes_gas_protection BOOLEAN DEFAULT FALSE,
    includes_vibration_protection BOOLEAN DEFAULT FALSE,
    base_material_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. public.orders (The central entity representing a client order)
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    order_name TEXT NOT NULL,
    description TEXT,
    commercial_status TEXT NOT NULL DEFAULT 'draft' CHECK (commercial_status = ANY (ARRAY['draft'::text, 'quoted'::text, 'approved'::text, 'invoiced'::text, 'paid'::text])),
    created_by UUID REFERENCES public.profiles(id),
    total_estimated_cost NUMERIC,
    total_actual_cost NUMERIC,
    project_lead_id UUID REFERENCES public.profiles(id),
    production_status TEXT NOT NULL DEFAULT 'pending' CHECK (production_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'on_hold'::text])),
    start_date TIMESTAMPTZ,
    completion_date TIMESTAMPTZ,
    total_transportation_cost NUMERIC DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. public.order_packages (Each individual piece of equipment being packed within an order)
CREATE TABLE public.order_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id),
    package_number INTEGER NOT NULL,
    description TEXT,
    packing_type_id UUID REFERENCES public.packing_types(id),
    equipment_original_dimensions JSONB NOT NULL,
    equipment_final_dimensions JSONB,
    equipment_original_net_weight_kg NUMERIC NOT NULL,
    equipment_final_net_weight_kg NUMERIC,
    box_internal_original_dimensions JSONB,
    box_internal_final_dimensions JSONB,
    box_external_original_dimensions JSONB,
    box_external_final_dimensions JSONB,
    status TEXT NOT NULL DEFAULT 'design' CHECK (status = ANY (ARRAY['design'::text, 'approved'::text, 'in_production'::text, 'packed'::text, 'delivered'::text])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (order_id, package_number)
);

-- 8. public.materials (High-level material categories)
CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. public.material_variants (Specific material items with attributes)
CREATE TABLE public.material_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES public.materials(id),
    variant_name TEXT NOT NULL,
    attributes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. public.order_package_materials (Bill of Materials for EACH specific `order_package`)
CREATE TABLE public.order_package_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_package_id UUID NOT NULL REFERENCES public.order_packages(id),
    material_variant_id UUID NOT NULL REFERENCES public.material_variants(id),
    quantity_calculated NUMERIC NOT NULL CHECK (quantity_calculated >= 0::numeric),
    unit_id UUID NOT NULL REFERENCES public.units_of_measure(id),
    quantity_actual NUMERIC,
    cost_actual NUMERIC,
    cost_at_calculation NUMERIC NOT NULL,
    usage_details JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (order_package_id, material_variant_id, usage_details)
);

-- 11. public.suppliers (Information about your material suppliers)
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    contact_info JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. public.supplier_pricing (Cost of a material variant from a specific supplier)
CREATE TABLE public.supplier_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_variant_id UUID NOT NULL REFERENCES public.material_variants(id),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    price NUMERIC NOT NULL CHECK (price >= 0::numeric),
    unit_id UUID NOT NULL REFERENCES public.units_of_measure(id),
    stock_level INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. public.tags (Generic tags for materials)
CREATE TABLE public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. public.material_tags (Join table for materials and tags)
CREATE TABLE public.material_tags (
    material_id UUID NOT NULL REFERENCES public.materials(id),
    tag_id UUID NOT NULL REFERENCES public.tags(id),
    CONSTRAINT material_tags_pkey PRIMARY KEY (material_id, tag_id)
);

-- 15. public.attendance_logs (Records daily attendance for packers on an order)
CREATE TABLE public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id),
    packer_id UUID NOT NULL REFERENCES public.profiles(id),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift_period TEXT NOT NULL CHECK (shift_period = ANY (ARRAY['morning'::text, 'afternoon'::text, 'full_day'::text])),
    status TEXT NOT NULL DEFAULT 'present' CHECK (status = ANY (ARRAY['present'::text, 'absent'::text])),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    toolbox_briefing_completed BOOLEAN DEFAULT FALSE, -- Track if mandatory briefing is completed
    is_project_start BOOLEAN DEFAULT FALSE, -- Mark if this is the first day of project for this packer
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, packer_id, log_date, shift_period)
);

-- 16. public.order_teams (Tracks which packers are assigned to a specific order)
CREATE TABLE public.order_teams (
    order_id UUID NOT NULL REFERENCES public.orders(id),
    packer_id UUID NOT NULL REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT order_teams_pkey PRIMARY KEY (order_id, packer_id)
);

-- 17. public.task_logs (Records individual tasks performed by packers on specific order packages)
CREATE TABLE public.task_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_package_id UUID NOT NULL REFERENCES public.order_packages(id),
    packer_id UUID NOT NULL REFERENCES public.profiles(id),
    task_name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. public.audit_log (For tracking changes to critical fields and urgent alerts)
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- e.g., 'order', 'order_package', 'profile', 'supplier_pricing'
    entity_id UUID NOT NULL,
    column_name TEXT,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES public.profiles(id),
    change_time TIMESTAMPTZ DEFAULT NOW(),
    action_type TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE', 'ALERT', 'PASSWORD_RESET', 'BLOCK_USER', 'UNBLOCK_USER', 'BAN_USER', 'ROLE_CHANGE', 'PROFILE_DELETE')), -- Added specific user actions
    is_critical_alert BOOLEAN DEFAULT FALSE,
    notes TEXT,
    order_id UUID REFERENCES public.orders(id) -- Direct link to order for project-specific audit filtering
);

-- 19. public.transportation (Detailed transportation costs, linked to an order)
CREATE TABLE public.transportation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id),
    vehicle_type TEXT,
    transport_date DATE NOT NULL,
    distance_km NUMERIC,
    cost_per_unit NUMERIC,
    unit_id UUID REFERENCES public.units_of_measure(id),
    total_cost NUMERIC NOT NULL,
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
