-- =====================================================
-- FIX PROJECT LEAD FUNCTION
-- This fixes the ambiguous column reference error by dropping and recreating the function
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Drop the existing function first (as suggested by the error)
DROP FUNCTION IF EXISTS update_project_lead_with_status(uuid,uuid);

-- 2. Recreate the function with corrected parameter name
CREATE OR REPLACE FUNCTION update_project_lead_with_status(order_uuid UUID, lead_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Update the project lead (renamed parameter to avoid ambiguity)
    UPDATE public.orders 
    SET project_lead_id = lead_id,
        updated_at = NOW()
    WHERE id = order_uuid;
    
    -- If the order is still pending and has a team assigned, move to in_progress
    UPDATE public.orders 
    SET production_status = 'in_progress',
        start_date = COALESCE(start_date, NOW()),
        updated_at = NOW()
    WHERE id = order_uuid 
    AND production_status = 'pending'
    AND EXISTS (
        SELECT 1 FROM public.order_teams 
        WHERE order_id = order_uuid 
        AND jsonb_array_length(packers_json) > 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION update_project_lead_with_status(UUID, UUID) TO authenticated;

-- =====================================================
-- TEST QUERY (uncomment to test)
-- =====================================================
-- SELECT update_project_lead_with_status('your-order-uuid', 'your-packer-uuid');
