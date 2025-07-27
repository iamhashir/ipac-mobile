-- =====================================================
-- DATABASE MIGRATION SCRIPT
-- Adding Packer Status Management and Multi-day Project Support
-- Run this in your Supabase SQL Editor AFTER the initial schema
-- =====================================================

-- 1. Add new columns to profiles table for packer status management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS packer_status TEXT DEFAULT 'available',
ADD COLUMN IF NOT EXISTS current_order_id UUID;

-- Add constraint for packer_status
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_packer_status_check 
CHECK (packer_status = ANY (ARRAY['available'::text, 'busy'::text, 'unavailable'::text]));

-- Add foreign key constraint for current_order_id
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_current_order_id_fkey 
FOREIGN KEY (current_order_id) REFERENCES public.orders(id);

-- 2. Add new columns to attendance_logs table for better tracking
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS toolbox_briefing_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_project_start BOOLEAN DEFAULT FALSE;

-- 3. Create function to automatically update packer status when assigned to order
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

-- 4. Create trigger for automatic packer status updates
DROP TRIGGER IF EXISTS trigger_update_packer_status ON public.order_teams;
CREATE TRIGGER trigger_update_packer_status
    AFTER INSERT OR DELETE ON public.order_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_packer_status_on_assignment();

-- 5. Create function to automatically update packer status when order is completed
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

-- 6. Create trigger for order completion
DROP TRIGGER IF EXISTS trigger_update_packer_status_on_completion ON public.orders;
CREATE TRIGGER trigger_update_packer_status_on_completion
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_packer_status_on_order_completion();

-- 7. Create function to check if packer needs daily attendance
CREATE OR REPLACE FUNCTION packer_needs_daily_attendance(
    packer_uuid UUID, 
    order_uuid UUID, 
    check_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if packer has logged attendance for today on this order
    RETURN NOT EXISTS (
        SELECT 1 FROM public.attendance_logs 
        WHERE packer_id = packer_uuid 
        AND order_id = order_uuid 
        AND log_date = check_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to get available packers (not busy)
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

-- 9. Create function to get busy packers with their current orders
CREATE OR REPLACE FUNCTION get_busy_packers()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    username TEXT,
    current_order_name TEXT,
    current_order_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.full_name, p.username, o.order_name, p.current_order_id
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    LEFT JOIN public.orders o ON p.current_order_id = o.id
    WHERE r.name = 'packer' 
    AND p.status = 'active'
    AND p.packer_status = 'busy';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Update any existing packers to have available status if they don't have assignments
UPDATE public.profiles 
SET packer_status = 'available'
WHERE id IN (
    SELECT p.id 
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE r.name = 'packer'
    AND p.packer_status IS NULL
);

-- 11. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_packer_status ON public.profiles(packer_status);
CREATE INDEX IF NOT EXISTS idx_profiles_current_order ON public.profiles(current_order_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date_packer ON public.attendance_logs(log_date, packer_id, order_id);

-- 12. Add comments for documentation
COMMENT ON COLUMN public.profiles.packer_status IS 'Tracks if packer is available for new assignments, busy with current order, or unavailable';
COMMENT ON COLUMN public.profiles.current_order_id IS 'References the order the packer is currently working on when busy';
COMMENT ON COLUMN public.attendance_logs.toolbox_briefing_completed IS 'Mandatory safety briefing completion status';
COMMENT ON COLUMN public.attendance_logs.is_project_start IS 'Marks the first day this packer worked on this project';

-- =====================================================
-- VERIFICATION QUERIES (Optional - for testing)
-- =====================================================

-- Check available packers
-- SELECT * FROM get_available_packers();

-- Check busy packers
-- SELECT * FROM get_busy_packers();

-- Check packer status distribution
-- SELECT packer_status, COUNT(*) as count
-- FROM public.profiles p
-- JOIN public.roles r ON p.role_id = r.id
-- WHERE r.name = 'packer'
-- GROUP BY packer_status;
