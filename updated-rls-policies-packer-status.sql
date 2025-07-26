-- =====================================================
-- UPDATED RLS POLICIES FOR PACKER STATUS MANAGEMENT
-- Run this AFTER the migration script to update security policies
-- =====================================================

-- Update the helper function to get available packers for selection
CREATE OR REPLACE FUNCTION get_available_packers_for_selection()
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
    AND (p.packer_status = 'available' OR auth.uid() = p.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the helper function to check if user is assigned to order (including current day requirement)
CREATE OR REPLACE FUNCTION user_assigned_to_order_today(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is assigned to order AND has logged attendance today
    RETURN EXISTS (
        SELECT 1 FROM public.order_teams ot
        WHERE ot.order_id = order_uuid 
        AND ot.packer_id = auth.uid()
    ) AND EXISTS (
        SELECT 1 FROM public.attendance_logs al
        WHERE al.order_id = order_uuid
        AND al.packer_id = auth.uid()
        AND al.log_date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the helper function to check if user needs to log attendance first
CREATE OR REPLACE FUNCTION user_needs_attendance_today(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is assigned to order but hasn't logged attendance today
    RETURN EXISTS (
        SELECT 1 FROM public.order_teams ot
        WHERE ot.order_id = order_uuid 
        AND ot.packer_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.attendance_logs al
        WHERE al.order_id = order_uuid
        AND al.packer_id = auth.uid()
        AND al.log_date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy for packers to see available projects (orders that are approved but not started)
CREATE POLICY "Packers can see available orders for selection" ON public.orders
  FOR SELECT USING (
    get_user_role() = 'packer' AND 
    production_status IN ('pending', 'approved') AND
    commercial_status = 'approved'
  );

-- Update the attendance logs policy to ensure daily attendance requirement
DROP POLICY IF EXISTS "Packers can create attendance_logs" ON public.attendance_logs;
CREATE POLICY "Packers can create attendance_logs" ON public.attendance_logs
  FOR INSERT WITH CHECK (
    get_user_role() = 'packer' AND 
    packer_id = auth.uid() AND
    user_assigned_to_order(order_id) AND
    -- Ensure only one attendance record per day per shift
    NOT EXISTS (
        SELECT 1 FROM public.attendance_logs 
        WHERE packer_id = auth.uid() 
        AND order_id = NEW.order_id 
        AND log_date = NEW.log_date 
        AND shift_period = NEW.shift_period
    )
  );

-- Update task logs policy to require daily attendance
DROP POLICY IF EXISTS "Packers can create task_logs" ON public.task_logs;
CREATE POLICY "Packers can create task_logs" ON public.task_logs
  FOR INSERT WITH CHECK (
    get_user_role() = 'packer' AND 
    packer_id = auth.uid() AND
    -- Must have logged attendance today for this order
    user_assigned_to_order_today((SELECT order_id FROM public.order_packages WHERE id = order_package_id))
  );

-- Update order packages policy to require attendance
DROP POLICY IF EXISTS "Packers can update assigned order_packages" ON public.order_packages;
CREATE POLICY "Packers can update assigned order_packages" ON public.order_packages
  FOR UPDATE USING (
    get_user_role() = 'packer' AND 
    user_assigned_to_order_today(order_id)
  );

-- Update order package materials policy to require attendance
DROP POLICY IF EXISTS "Packers can update package_materials actuals" ON public.order_package_materials;
CREATE POLICY "Packers can update package_materials actuals" ON public.order_package_materials
  FOR UPDATE USING (
    get_user_role() = 'packer' AND 
    user_assigned_to_order_today((SELECT order_id FROM public.order_packages WHERE id = order_package_id))
  );

-- Add policy for packers to read their current status
CREATE POLICY "Packers can read own packer_status" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR
    get_user_role() IN ('admin', 'director', 'project_lead')
  );

-- Grant necessary permissions for the new functions
GRANT EXECUTE ON FUNCTION get_available_packers_for_selection() TO authenticated;
GRANT EXECUTE ON FUNCTION user_assigned_to_order_today(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_needs_attendance_today(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION packer_needs_daily_attendance(UUID, UUID, DATE) TO authenticated;

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
            auth.uid(),
            'UPDATE',
            'Packer status changed automatically'
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

-- Create view for active orders that need packer assignment
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
WHERE o.production_status IN ('pending', 'approved')
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
