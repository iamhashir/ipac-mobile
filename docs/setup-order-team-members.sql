-- =====================================================
-- SETUP: ORDER_TEAM_MEMBERS JUNCTION TABLE APPROACH
-- This script sets up the new relational team management system
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: ENSURE order_team_members TABLE IS PROPERLY CONFIGURED
-- =====================================================

-- Ensure the table exists with proper constraints
CREATE TABLE IF NOT EXISTS public.order_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    packer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure no duplicate assignments
    UNIQUE(order_id, packer_id)
);

-- Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_team_members_order_id ON public.order_team_members(order_id);
CREATE INDEX IF NOT EXISTS idx_order_team_members_packer_id ON public.order_team_members(packer_id);
CREATE INDEX IF NOT EXISTS idx_order_team_members_created_at ON public.order_team_members(created_at);

-- Add comments for clarity
COMMENT ON TABLE public.order_team_members IS 'Junction table linking orders to assigned packers. Uses proper relational design for better performance and querying.';
COMMENT ON COLUMN public.order_team_members.order_id IS 'References the order this packer is assigned to';
COMMENT ON COLUMN public.order_team_members.packer_id IS 'References the packer assigned to this order';
COMMENT ON COLUMN public.order_team_members.created_at IS 'When this packer was assigned to the order';

-- =====================================================
-- STEP 2: CREATE TEAM MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to assign packers to an order
CREATE OR REPLACE FUNCTION assign_packers_to_order(order_uuid UUID, packer_ids UUID[])
RETURNS BOOLEAN AS $$
DECLARE
    packer_id UUID;
BEGIN
    -- Validate that order exists
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = order_uuid) THEN
        RAISE EXCEPTION 'Order with ID % does not exist', order_uuid;
    END IF;
    
    -- Remove all current assignments for this order
    DELETE FROM public.order_team_members WHERE order_id = order_uuid;
    
    -- Insert new assignments
    FOREACH packer_id IN ARRAY packer_ids
    LOOP
        -- Validate that packer exists and is active
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles p 
            JOIN public.roles r ON p.role_id = r.id 
            WHERE p.id = packer_id 
            AND p.status = 'active' 
            AND r.name = 'packer'
        ) THEN
            RAISE EXCEPTION 'Packer with ID % does not exist or is not an active packer', packer_id;
        END IF;
        
        -- Insert the assignment
        INSERT INTO public.order_team_members (order_id, packer_id)
        VALUES (order_uuid, packer_id)
        ON CONFLICT (order_id, packer_id) DO NOTHING;
    END LOOP;
    
    -- Update order status to 'in_progress' if it was 'pending'
    UPDATE public.orders 
    SET 
        production_status = 'in_progress',
        start_date = COALESCE(start_date, NOW()),
        updated_at = NOW()
    WHERE id = order_uuid 
    AND production_status = 'pending';
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get packers assigned to an order
CREATE OR REPLACE FUNCTION get_order_packers(order_uuid UUID)
RETURNS TABLE (
    packer_id UUID,
    full_name TEXT,
    username TEXT,
    packer_status TEXT,
    assigned_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.username,
        p.packer_status,
        otm.created_at
    FROM public.order_team_members otm
    JOIN public.profiles p ON otm.packer_id = p.id
    WHERE otm.order_id = order_uuid
    ORDER BY otm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is assigned to an order
CREATE OR REPLACE FUNCTION user_assigned_to_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.order_team_members 
        WHERE order_id = order_uuid 
        AND packer_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team count for an order
CREATE OR REPLACE FUNCTION get_order_team_count(order_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.order_team_members 
        WHERE order_id = order_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove packer from order team
CREATE OR REPLACE FUNCTION remove_packer_from_order(order_uuid UUID, packer_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM public.order_team_members 
    WHERE order_id = order_uuid AND packer_id = packer_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add single packer to order team
CREATE OR REPLACE FUNCTION add_packer_to_order(order_uuid UUID, packer_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate that order exists
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = order_uuid) THEN
        RAISE EXCEPTION 'Order with ID % does not exist', order_uuid;
    END IF;
    
    -- Validate that packer exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles p 
        JOIN public.roles r ON p.role_id = r.id 
        WHERE p.id = packer_uuid 
        AND p.status = 'active' 
        AND r.name = 'packer'
    ) THEN
        RAISE EXCEPTION 'Packer with ID % does not exist or is not an active packer', packer_uuid;
    END IF;
    
    -- Insert the assignment
    INSERT INTO public.order_team_members (order_id, packer_id)
    VALUES (order_uuid, packer_uuid)
    ON CONFLICT (order_id, packer_id) DO NOTHING;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 3: CREATE TRIGGERS FOR AUTOMATIC STATUS UPDATES
-- =====================================================

-- Drop any existing triggers/functions that might conflict
DROP TRIGGER IF EXISTS trigger_update_packer_status ON public.order_team_members;
DROP TRIGGER IF EXISTS trigger_update_packer_status_on_completion ON public.orders;
DROP FUNCTION IF EXISTS update_packer_status_on_assignment();
DROP FUNCTION IF EXISTS update_packer_status_on_order_completion();

-- Trigger function to update packer status when team assignments change
CREATE OR REPLACE FUNCTION update_packer_status_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT (packer assigned to order)
    IF TG_OP = 'INSERT' THEN
        UPDATE public.profiles 
        SET 
            packer_status = 'busy', 
            current_order_id = NEW.order_id,
            updated_at = NOW()
        WHERE id = NEW.packer_id;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE (packer removed from order)
    IF TG_OP = 'DELETE' THEN
        -- Check if packer has other active assignments
        IF NOT EXISTS (
            SELECT 1 FROM public.order_team_members otm
            JOIN public.orders o ON otm.order_id = o.id
            WHERE otm.packer_id = OLD.packer_id 
            AND o.production_status IN ('pending', 'in_progress')
        ) THEN
            -- No other active assignments, mark as available
            UPDATE public.profiles 
            SET 
                packer_status = 'available', 
                current_order_id = NULL,
                updated_at = NOW()
            WHERE id = OLD.packer_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on order_team_members table
CREATE TRIGGER trigger_update_packer_status_on_team_change
    AFTER INSERT OR DELETE ON public.order_team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_packer_status_on_assignment();

-- Trigger function to update packer status when order is completed
CREATE OR REPLACE FUNCTION update_packer_status_on_order_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- When an order is completed, mark all assigned packers as available
    IF NEW.production_status = 'completed' AND OLD.production_status != 'completed' THEN
        UPDATE public.profiles 
        SET 
            packer_status = 'available', 
            current_order_id = NULL,
            updated_at = NOW()
        WHERE id IN (
            SELECT packer_id FROM public.order_team_members 
            WHERE order_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on orders table for completion
CREATE TRIGGER trigger_update_packer_status_on_completion
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_packer_status_on_order_completion();

-- =====================================================
-- STEP 4: CREATE/RECREATE VIEWS
-- =====================================================

-- Drop and recreate the available orders view
DROP VIEW IF EXISTS available_orders_for_assignment;

CREATE VIEW available_orders_for_assignment AS
SELECT 
    o.id,
    o.order_name,
    o.description,
    c.name as client_name,
    o.production_status,
    o.commercial_status,
    o.project_lead_id,
    pl.full_name as project_lead_name,
    COALESCE(team_count.assigned_packers_count, 0) as assigned_packers_count,
    o.start_date,
    o.created_at
FROM public.orders o
JOIN public.clients c ON o.client_id = c.id
LEFT JOIN public.profiles pl ON o.project_lead_id = pl.id
LEFT JOIN (
    SELECT 
        order_id, 
        COUNT(*)::INTEGER as assigned_packers_count
    FROM public.order_team_members
    GROUP BY order_id
) team_count ON o.id = team_count.order_id
WHERE o.production_status IN ('pending', 'in_progress')
AND o.commercial_status = 'approved';

-- =====================================================
-- STEP 5: SET UP RLS POLICIES
-- =====================================================

-- Enable RLS on order_team_members
ALTER TABLE public.order_team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin roles can manage order_team_members" ON public.order_team_members;
DROP POLICY IF EXISTS "Packers can read own team assignments" ON public.order_team_members;
DROP POLICY IF EXISTS "Project leads can read team assignments" ON public.order_team_members;

-- Admin roles can manage all team assignments
CREATE POLICY "Admin roles can manage order_team_members" ON public.order_team_members
    FOR ALL USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- Packers can read their own team assignments
CREATE POLICY "Packers can read own team assignments" ON public.order_team_members
    FOR SELECT USING (
        get_user_role() = 'packer' AND packer_id = auth.uid()
    );

-- Project leads can read team assignments for their orders
CREATE POLICY "Project leads can read team assignments" ON public.order_team_members
    FOR SELECT USING (
        get_user_role() = 'project_lead' 
        AND EXISTS (
            SELECT 1 FROM public.orders 
            WHERE id = order_id AND project_lead_id = auth.uid()
        )
    );

-- =====================================================
-- STEP 6: GRANT PERMISSIONS
-- =====================================================

-- Grant function permissions
GRANT EXECUTE ON FUNCTION assign_packers_to_order(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_packers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_assigned_to_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_team_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_packer_from_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_packer_to_order(UUID, UUID) TO authenticated;

-- Grant view access
GRANT SELECT ON available_orders_for_assignment TO authenticated;

-- =====================================================
-- STEP 7: HELPER FUNCTIONS FOR ENHANCED FUNCTIONALITY
-- =====================================================

-- Function to get all orders for a packer
CREATE OR REPLACE FUNCTION get_packer_orders(packer_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    order_id UUID,
    order_name TEXT,
    client_name TEXT,
    production_status TEXT,
    project_lead_name TEXT,
    assigned_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_name,
        c.name,
        o.production_status,
        pl.full_name,
        otm.created_at
    FROM public.order_team_members otm
    JOIN public.orders o ON otm.order_id = o.id
    JOIN public.clients c ON o.client_id = c.id
    LEFT JOIN public.profiles pl ON o.project_lead_id = pl.id
    WHERE otm.packer_id = packer_uuid
    ORDER BY otm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team statistics
CREATE OR REPLACE FUNCTION get_team_statistics()
RETURNS TABLE (
    total_active_orders INTEGER,
    total_assigned_packers INTEGER,
    average_team_size NUMERIC,
    orders_needing_teams INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM public.orders 
         WHERE production_status IN ('pending', 'in_progress')),
        (SELECT COUNT(DISTINCT packer_id)::INTEGER FROM public.order_team_members otm
         JOIN public.orders o ON otm.order_id = o.id
         WHERE o.production_status IN ('pending', 'in_progress')),
        (SELECT ROUND(AVG(team_size), 2) FROM (
            SELECT COUNT(*) as team_size
            FROM public.order_team_members otm
            JOIN public.orders o ON otm.order_id = o.id
            WHERE o.production_status IN ('pending', 'in_progress')
            GROUP BY otm.order_id
        ) team_sizes),
        (SELECT COUNT(*)::INTEGER FROM public.orders o
         WHERE o.production_status IN ('pending', 'in_progress')
         AND NOT EXISTS (
             SELECT 1 FROM public.order_team_members otm 
             WHERE otm.order_id = o.id
         ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on new functions
GRANT EXECUTE ON FUNCTION get_packer_orders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_statistics() TO authenticated;

-- =====================================================
-- STEP 8: VERIFICATION AND SUCCESS MESSAGE
-- =====================================================

-- Verification function
CREATE OR REPLACE FUNCTION verify_team_setup()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check if order_team_members table exists
    RETURN QUERY
    SELECT 
        'table_exists'::TEXT,
        CASE WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'order_team_members'
        ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'order_team_members table exists'::TEXT;
    
    -- Check if functions exist
    RETURN QUERY
    SELECT 
        'functions_exist'::TEXT,
        CASE WHEN EXISTS (
            SELECT FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name = 'assign_packers_to_order'
        ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Team management functions exist'::TEXT;
    
    -- Check if triggers are in place
    RETURN QUERY
    SELECT 
        'triggers_exist'::TEXT,
        CASE WHEN EXISTS (
            SELECT FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND trigger_name = 'trigger_update_packer_status_on_team_change'
        ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Triggers are in place'::TEXT;
    
    -- Check RLS status
    RETURN QUERY
    SELECT 
        'rls_enabled'::TEXT,
        CASE WHEN (
            SELECT rls_enabled FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = 'order_team_members'
        ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'RLS enabled on order_team_members'::TEXT;
    
    -- Check indexes
    RETURN QUERY
    SELECT 
        'indexes_exist'::TEXT,
        CASE WHEN EXISTS (
            SELECT FROM pg_indexes 
            WHERE schemaname = 'public' AND tablename = 'order_team_members'
            AND indexname = 'idx_order_team_members_order_id'
        ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Performance indexes created'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run verification
SELECT * FROM verify_team_setup();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ORDER_TEAM_MEMBERS SETUP COMPLETED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'New relational team management system is ready!';
    RAISE NOTICE '';
    RAISE NOTICE 'Key benefits:';
    RAISE NOTICE '✓ Better query performance with proper indexes';
    RAISE NOTICE '✓ Referential integrity with foreign key constraints';
    RAISE NOTICE '✓ Standard relational database patterns';
    RAISE NOTICE '✓ Easier complex queries and reporting';
    RAISE NOTICE '✓ Better scalability for large teams';
    RAISE NOTICE '';
    RAISE NOTICE 'Main functions available:';
    RAISE NOTICE '• assign_packers_to_order(order_id, packer_ids[])';
    RAISE NOTICE '• get_order_packers(order_id)';
    RAISE NOTICE '• user_assigned_to_order(order_id)';
    RAISE NOTICE '• add_packer_to_order(order_id, packer_id)';
    RAISE NOTICE '• remove_packer_from_order(order_id, packer_id)';
    RAISE NOTICE '• get_packer_orders(packer_id)';
    RAISE NOTICE '• get_team_statistics()';
END $$;
