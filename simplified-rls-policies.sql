-- =====================================================
-- SIMPLIFIED RLS POLICIES FOR PACKER STATUS MANAGEMENT
-- This replaces the complex updated-rls-policies-packer-status.sql
-- Run this AFTER the database-migration-packer-status.sql
-- =====================================================

-- First, ensure the get_user_role function exists (it should be from the original RLS file)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Fetch the role name for the current authenticated user
    SELECT r.name INTO user_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
    AND p.status = 'active';
    
    RETURN COALESCE(user_role, 'unknown');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;

-- =====================================================
-- SIMPLIFIED HELPER FUNCTIONS
-- =====================================================

-- Simple function to check if user is assigned to an order
CREATE OR REPLACE FUNCTION user_assigned_to_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.order_teams 
    WHERE order_id = order_uuid 
    AND packer_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if packer has logged attendance today for an order
CREATE OR REPLACE FUNCTION packer_logged_attendance_today(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.attendance_logs 
    WHERE order_id = order_uuid 
    AND packer_id = auth.uid() 
    AND log_date = CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION user_assigned_to_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION packer_logged_attendance_today(UUID) TO authenticated;

-- =====================================================
-- SIMPLIFIED RLS POLICIES
-- =====================================================

-- Policy for packers to see available orders for team selection
DROP POLICY IF EXISTS "Packers can see available orders for selection" ON public.orders;
CREATE POLICY "Packers can see available orders for selection" ON public.orders
  FOR SELECT USING (
    get_user_role() = 'packer' AND 
    production_status IN ('pending', 'in_progress') AND
    commercial_status = 'approved'
  );

-- Update attendance logs policy - simplified
DROP POLICY IF EXISTS "Packers can create attendance_logs" ON public.attendance_logs;
CREATE POLICY "Packers can create attendance_logs" ON public.attendance_logs
  FOR INSERT WITH CHECK (
    get_user_role() = 'packer' AND 
    packer_id = auth.uid() AND
    user_assigned_to_order(order_id)
  );

-- Update task logs policy - simplified (just check assignment, not daily attendance)
DROP POLICY IF EXISTS "Packers can create task_logs" ON public.task_logs;
CREATE POLICY "Packers can create task_logs" ON public.task_logs
  FOR INSERT WITH CHECK (
    get_user_role() = 'packer' AND 
    packer_id = auth.uid() AND
    user_assigned_to_order((SELECT order_id FROM public.order_packages WHERE id = order_package_id))
  );

-- Update order packages policy - simplified
DROP POLICY IF EXISTS "Packers can update assigned order_packages" ON public.order_packages;
CREATE POLICY "Packers can update assigned order_packages" ON public.order_packages
  FOR UPDATE USING (
    get_user_role() = 'packer' AND 
    user_assigned_to_order(order_id)
  );

-- Update order package materials policy - simplified
DROP POLICY IF EXISTS "Packers can update package_materials actuals" ON public.order_package_materials;
CREATE POLICY "Packers can update package_materials actuals" ON public.order_package_materials
  FOR UPDATE USING (
    get_user_role() = 'packer' AND 
    user_assigned_to_order((SELECT order_id FROM public.order_packages WHERE id = order_package_id))
  );

-- =====================================================
-- AUDIT TRIGGERS FOR PACKER STATUS CHANGES
-- =====================================================

-- Create function to log packer status changes
CREATE OR REPLACE FUNCTION log_packer_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log packer status changes to audit log
    IF OLD.packer_status IS DISTINCT FROM NEW.packer_status THEN
        INSERT INTO public.audit_log (
            entity_type,
            entity_id,
            column_name,
            old_value,
            new_value,
            changed_by,
            action_type,
            notes
        ) VALUES (
            'profile',
            NEW.id,
            'packer_status',
            to_jsonb(OLD.packer_status),
            to_jsonb(NEW.packer_status),
            COALESCE(auth.uid(), NEW.id), -- Use NEW.id if auth.uid() is null (for system updates)
            'UPDATE',
            'Packer status changed'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for packer status audit
DROP TRIGGER IF EXISTS trigger_log_packer_status_change ON public.profiles;
CREATE TRIGGER trigger_log_packer_status_change
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_packer_status_change();

-- =====================================================
-- HELPER VIEWS FOR EASIER DATA ACCESS
-- =====================================================

-- Create view for available orders that can be selected by packers
CREATE OR REPLACE VIEW available_orders_for_assignment AS
SELECT 
    o.id,
    o.order_name,
    o.description,
    c.name as client_name,
    pl.full_name as project_lead_name,
    o.production_status,
    o.commercial_status,
    COALESCE(team_count.count, 0) as assigned_packers_count
FROM public.orders o
JOIN public.clients c ON o.client_id = c.id
LEFT JOIN public.profiles pl ON o.project_lead_id = pl.id
LEFT JOIN (
    SELECT order_id, COUNT(*) as count
    FROM public.order_teams
    GROUP BY order_id
) team_count ON o.id = team_count.order_id
WHERE o.production_status IN ('pending', 'in_progress')
AND o.commercial_status = 'approved';

-- Create view for packer availability status
CREATE OR REPLACE VIEW packer_availability_status AS
SELECT 
    p.id,
    p.full_name,
    p.username,
    p.packer_status,
    p.current_order_id,
    o.order_name as current_order_name,
    CASE 
        WHEN p.packer_status = 'available' THEN 'Available for assignment'
        WHEN p.packer_status = 'busy' THEN CONCAT('Working on: ', COALESCE(o.order_name, 'Unknown Order'))
        WHEN p.packer_status = 'unavailable' THEN 'Not available'
        ELSE 'Status unknown'
    END as status_description
FROM public.profiles p
JOIN public.roles r ON p.role_id = r.id
LEFT JOIN public.orders o ON p.current_order_id = o.id
WHERE r.name = 'packer'
AND p.status = 'active';

-- Grant permissions on views
GRANT SELECT ON available_orders_for_assignment TO authenticated;
GRANT SELECT ON packer_availability_status TO authenticated;

-- =====================================================
-- ADDITIONAL HELPER FUNCTIONS FOR THE APP
-- =====================================================

-- Function to get available packers (not busy)
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_available_packers() TO authenticated;
