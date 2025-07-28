-- =====================================================
-- COMPLETE DATABASE SETUP FOR IPAC OPERATIONS APP
-- Run this in Supabase SQL Editor to set up all required tables and functions
-- =====================================================

-- 1. Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    can_block_users BOOLEAN DEFAULT FALSE,
    can_unblock_users BOOLEAN DEFAULT FALSE,
    can_ban_users BOOLEAN DEFAULT FALSE,
    can_reset_passwords BOOLEAN DEFAULT FALSE,
    can_delete_profiles BOOLEAN DEFAULT FALSE,
    can_manage_roles BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create orders table (before profiles to avoid circular dependency)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    order_name TEXT NOT NULL,
    description TEXT,
    commercial_status TEXT NOT NULL DEFAULT 'draft' CHECK (commercial_status = ANY (ARRAY['draft'::text, 'quoted'::text, 'approved'::text, 'invoiced'::text, 'paid'::text])),
    created_by UUID, -- Will add foreign key constraint later
    total_estimated_cost NUMERIC,
    total_actual_cost NUMERIC,
    project_lead_id UUID, -- Will add foreign key constraint later
    production_status TEXT NOT NULL DEFAULT 'pending' CHECK (production_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'on_hold'::text])),
    start_date TIMESTAMPTZ,
    completion_date TIMESTAMPTZ,
    total_transportation_cost NUMERIC DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    phone_number TEXT,
    role_id UUID NOT NULL REFERENCES public.roles(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'blocked'::text, 'banned'::text])),
    packer_status TEXT DEFAULT 'available' CHECK (packer_status = ANY (ARRAY['available'::text, 'busy'::text, 'unavailable'::text])),
    current_order_id UUID REFERENCES public.orders(id),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add foreign key constraints to orders table now that profiles exists
-- Note: These constraints may already exist, so commenting out to avoid duplicate constraint errors
-- ALTER TABLE public.orders 
-- ADD CONSTRAINT orders_created_by_fkey 
-- FOREIGN KEY (created_by) REFERENCES public.profiles(id);

-- ALTER TABLE public.orders 
-- ADD CONSTRAINT orders_project_lead_id_fkey 
-- FOREIGN KEY (project_lead_id) REFERENCES public.profiles(id);

-- 6. Create order_teams table
CREATE TABLE IF NOT EXISTS public.order_teams (
    order_id UUID NOT NULL REFERENCES public.orders(id),
    packer_id UUID NOT NULL REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT order_teams_pkey PRIMARY KEY (order_id, packer_id)
);

-- 7. Create attendance_logs table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id),
    packer_id UUID NOT NULL REFERENCES public.profiles(id),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift_period TEXT NOT NULL CHECK (shift_period = ANY (ARRAY['morning'::text, 'afternoon'::text, 'full_day'::text])),
    status TEXT NOT NULL DEFAULT 'present' CHECK (status = ANY (ARRAY['present'::text, 'absent'::text])),
    start_time TEXT, -- Store as text for now, can be converted to timestamp later
    end_time TIMESTAMPTZ,
    toolbox_briefing_completed BOOLEAN DEFAULT FALSE,
    is_project_start BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, packer_id, log_date, shift_period)
);

-- 8. Create units_of_measure table
CREATE TABLE IF NOT EXISTS public.units_of_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create packing_types table
CREATE TABLE IF NOT EXISTS public.packing_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    includes_contact BOOLEAN DEFAULT FALSE,
    includes_waterproofing BOOLEAN DEFAULT FALSE,
    includes_gas_protection BOOLEAN DEFAULT FALSE,
    includes_vibration_protection BOOLEAN DEFAULT FALSE,
    base_material_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INSERT INITIAL DATA
-- =====================================================

-- Insert roles
INSERT INTO public.roles (name, can_block_users, can_unblock_users, can_ban_users, can_reset_passwords, can_delete_profiles, can_manage_roles) 
VALUES 
  ('director', true, true, true, true, true, true),
  ('admin', true, true, false, true, false, false),
  ('project_lead', true, true, false, false, false, false),
  ('sales', false, false, false, false, false, false),
  ('packer', false, false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;

-- Insert test clients
INSERT INTO public.clients (name, contact_person, email, phone, address)
VALUES 
  ('ABC Manufacturing', 'John Smith', 'john@abcmfg.com', '+1-555-0101', '123 Industrial Ave'),
  ('XYZ Logistics', 'Jane Doe', 'jane@xyzlogistics.com', '+1-555-0102', '456 Shipping Blvd')
ON CONFLICT (name) DO NOTHING;

-- Insert test orders
INSERT INTO public.orders (client_id, order_name, description, commercial_status, production_status)
SELECT 
  c.id, 
  'AIR LIQUIDE-B-10091', 
  'Industrial equipment packaging for air separation unit',
  'approved',
  'pending'
FROM public.clients c WHERE c.name = 'ABC Manufacturing'
ON CONFLICT DO NOTHING;

INSERT INTO public.orders (client_id, order_name, description, commercial_status, production_status)
SELECT 
  c.id, 
  'MTU-Engine-981999',
  'MTU Engine packaging with vibration protection',
  'approved', 
  'pending'
FROM public.clients c WHERE c.name = 'XYZ Logistics'
ON CONFLICT DO NOTHING;

-- Insert units of measure
INSERT INTO public.units_of_measure (name, description)
VALUES 
  ('Pce', 'Pieces'),
  ('m2', 'Square meters'),
  ('kg', 'Kilograms'),
  ('m', 'Meters'),
  ('hour', 'Hours'),
  ('trip', 'Trips')
ON CONFLICT (name) DO NOTHING;

-- Insert packing types
INSERT INTO public.packing_types (code, name, description, includes_contact, includes_waterproofing)
VALUES 
  ('4A', 'Contact Wood', 'Standard wood contact packaging', true, false),
  ('4B', 'Waterproofing', 'Waterproof packaging with barrier protection', true, true),
  ('4C', 'Gas Protection', 'Gas barrier protection packaging', true, true),
  ('1A', 'Vibration Protection', 'Anti-vibration packaging system', true, false)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- CREATE FUNCTIONS AND VIEWS
-- =====================================================

-- Function to get available packers
CREATE OR REPLACE FUNCTION get_available_packers()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    username TEXT,
    packer_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.full_name, p.username, p.packer_status
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE r.name = 'packer' 
    AND p.status = 'active'
    AND p.packer_status = 'available';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for available orders for assignment
CREATE OR REPLACE VIEW available_orders_for_assignment AS
SELECT 
    o.id,
    o.order_name,
    o.description,
    c.name as client_name
FROM public.orders o
JOIN public.clients c ON o.client_id = c.id
WHERE o.production_status IN ('pending', 'in_progress');

-- Function to update packer status when assigned to order
CREATE OR REPLACE FUNCTION update_packer_status_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- When a packer is assigned to an order team, mark them as busy
    IF TG_OP = 'INSERT' THEN
        UPDATE public.profiles 
        SET packer_status = 'busy', 
            current_order_id = NEW.order_id,
            updated_at = NOW()
        WHERE id = NEW.packer_id;
        RETURN NEW;
    END IF;
    
    -- When a packer is removed from an order team, check if they have other assignments
    IF TG_OP = 'DELETE' THEN
        -- Check if packer has other active assignments
        IF NOT EXISTS (
            SELECT 1 FROM public.order_teams ot
            JOIN public.orders o ON ot.order_id = o.id
            WHERE ot.packer_id = OLD.packer_id 
            AND o.production_status IN ('pending', 'in_progress')
        ) THEN
            -- No other active assignments, mark as available
            UPDATE public.profiles 
            SET packer_status = 'available', 
                current_order_id = NULL,
                updated_at = NOW()
            WHERE id = OLD.packer_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic packer status updates
DROP TRIGGER IF EXISTS trigger_update_packer_status ON public.order_teams;
CREATE TRIGGER trigger_update_packer_status
    AFTER INSERT OR DELETE ON public.order_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_packer_status_on_assignment();

-- Function to update packer status when order is completed
CREATE OR REPLACE FUNCTION update_packer_status_on_order_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- When an order is completed, mark all assigned packers as available
    IF NEW.production_status = 'completed' AND OLD.production_status != 'completed' THEN
        UPDATE public.profiles 
        SET packer_status = 'available', 
            current_order_id = NULL,
            updated_at = NOW()
        WHERE id IN (
            SELECT packer_id FROM public.order_teams 
            WHERE order_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order completion
DROP TRIGGER IF EXISTS trigger_update_packer_status_on_completion ON public.orders;
CREATE TRIGGER trigger_update_packer_status_on_completion
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_packer_status_on_order_completion();

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Create policies - Allow authenticated users to read most data
CREATE POLICY "Allow authenticated users to read profiles" ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read orders" ON public.orders
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read order_teams" ON public.order_teams
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read attendance_logs" ON public.attendance_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read clients" ON public.clients
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read roles" ON public.roles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update certain tables
CREATE POLICY "Allow authenticated users to insert order_teams" ON public.order_teams
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert attendance_logs" ON public.attendance_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update profiles" ON public.profiles
    FOR UPDATE USING (auth.role() = 'authenticated');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check available packers
-- SELECT * FROM get_available_packers();

-- Check available orders
-- SELECT * FROM available_orders_for_assignment;

-- Check roles
-- SELECT * FROM public.roles;

-- Check clients and orders
-- SELECT o.order_name, c.name as client_name FROM public.orders o JOIN public.clients c ON o.client_id = c.id;
