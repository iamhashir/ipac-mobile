-- =====================================================
-- DATABASE UPDATES FOR ORDER WORKFLOW IMPROVEMENTS
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Remove project_lead role since it's not a standalone role
DELETE FROM public.roles WHERE name = 'project_lead';

-- 2. Remove project_lead_id column from orders table (if it exists)
ALTER TABLE public.orders DROP COLUMN IF EXISTS project_lead_id;

-- 3. Add quantity and boxes_completed to order_packages
ALTER TABLE public.order_packages 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS boxes_completed INTEGER DEFAULT 0;

-- Add constraints to ensure valid values
ALTER TABLE public.order_packages 
ADD CONSTRAINT order_packages_quantity_positive CHECK (quantity > 0),
ADD CONSTRAINT order_packages_boxes_completed_valid CHECK (boxes_completed >= 0 AND boxes_completed <= quantity);

-- 4. Add a project_lead_id to orders table that references a packer (not a role)
-- This will be set when a team is assigned and one packer is chosen as lead
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS project_lead_id UUID REFERENCES public.profiles(id);

-- 5. Create function to automatically update boxes_completed status
CREATE OR REPLACE FUNCTION update_package_status_on_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- When boxes_completed equals quantity, mark as packed
    IF NEW.boxes_completed = NEW.quantity AND OLD.boxes_completed != NEW.quantity THEN
        NEW.status = 'packed';
    -- When boxes_completed is between 0 and quantity, mark as in_production
    ELSIF NEW.boxes_completed > 0 AND NEW.boxes_completed < NEW.quantity THEN
        NEW.status = 'in_production';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for automatic status updates
DROP TRIGGER IF EXISTS trigger_update_package_status ON public.order_packages;
CREATE TRIGGER trigger_update_package_status
    BEFORE UPDATE ON public.order_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_package_status_on_completion();

-- 7. Update audit_log to support order_package_id for better filtering
ALTER TABLE public.audit_log 
ADD COLUMN IF NOT EXISTS order_package_id UUID REFERENCES public.order_packages(id);

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_packages_quantity ON public.order_packages(quantity, boxes_completed);
CREATE INDEX IF NOT EXISTS idx_audit_log_order_package ON public.audit_log(order_package_id);
CREATE INDEX IF NOT EXISTS idx_orders_project_lead ON public.orders(project_lead_id);

-- 9. Create function to get order progress summary
CREATE OR REPLACE FUNCTION get_order_progress(order_uuid UUID)
RETURNS TABLE (
    total_packages BIGINT,
    total_boxes BIGINT,
    completed_boxes BIGINT,
    completion_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_packages,
        SUM(op.quantity) as total_boxes,
        SUM(op.boxes_completed) as completed_boxes,
        CASE 
            WHEN SUM(op.quantity) > 0 THEN 
                ROUND((SUM(op.boxes_completed)::NUMERIC / SUM(op.quantity)::NUMERIC) * 100, 2)
            ELSE 0
        END as completion_percentage
    FROM public.order_packages op
    WHERE op.order_id = order_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to check if user can be assigned as project lead
CREATE OR REPLACE FUNCTION can_be_project_lead(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is a packer and is available/busy but not unavailable
    RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = user_uuid
        AND r.name = 'packer'
        AND p.status = 'active'
        AND (p.packer_status IN ('available', 'busy'))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Update RLS policies to remove project_lead references
DROP POLICY IF EXISTS "Project leads can read all orders" ON public.orders;
DROP POLICY IF EXISTS "Project leads can modify orders" ON public.orders;

-- 12. Add comments for documentation
COMMENT ON COLUMN public.order_packages.quantity IS 'Number of identical equipment pieces requiring the same packaging';
COMMENT ON COLUMN public.order_packages.boxes_completed IS 'Number of completed boxes out of total quantity';
COMMENT ON COLUMN public.orders.project_lead_id IS 'Packer assigned as project lead (chosen during team assignment)';
COMMENT ON COLUMN public.audit_log.order_package_id IS 'Links audit entries to specific order packages for better filtering';

-- 13. Grant permissions
GRANT EXECUTE ON FUNCTION get_order_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_be_project_lead(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES (Optional - for testing)
-- =====================================================

-- Check roles after cleanup
-- SELECT * FROM public.roles ORDER BY name;

-- Check order_packages structure
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'order_packages' AND table_schema = 'public';

-- Test order progress function
-- SELECT * FROM get_order_progress('some-order-uuid');
