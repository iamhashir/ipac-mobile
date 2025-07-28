-- =====================================================
-- FIX ORDER ASSIGNMENT ISSUES
-- This fixes the problem where orders remain clickable and don't get set to "in_progress"
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Fix the assign_packers_to_order function to properly update order status
CREATE OR REPLACE FUNCTION assign_packers_to_order(order_uuid UUID, packer_ids UUID[])
RETURNS UUID AS $$
DECLARE
    team_id UUID;
    packers_json JSONB;
BEGIN
    -- Convert UUID array to JSONB array
    SELECT jsonb_agg(packer_id) INTO packers_json FROM unnest(packer_ids) AS packer_id;
    
    -- Check if order team already exists
    SELECT id INTO team_id FROM public.order_teams WHERE order_id = order_uuid;
    
    IF team_id IS NOT NULL THEN
        -- Update existing team
        UPDATE public.order_teams 
        SET packers_json = packers_json, assigned_at = NOW()
        WHERE id = team_id;
    ELSE
        -- Create new team
        INSERT INTO public.order_teams (order_id, packers_json)
        VALUES (order_uuid, packers_json)
        RETURNING id INTO team_id;
    END IF;
    
    -- IMPORTANT: Update order status to 'in_progress' when team is assigned
    UPDATE public.orders 
    SET production_status = 'in_progress',
        start_date = COALESCE(start_date, NOW()),
        updated_at = NOW()
    WHERE id = order_uuid 
    AND production_status = 'pending';
    
    RETURN team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update the available_orders_for_assignment view to exclude in_progress orders properly
CREATE OR REPLACE VIEW available_orders_for_assignment AS
SELECT 
    o.id,
    o.order_name,
    o.description,
    c.name as client_name,
    o.production_status,
    o.commercial_status,
    COALESCE(
        (SELECT jsonb_array_length(ot.packers_json) 
         FROM public.order_teams ot 
         WHERE ot.order_id = o.id), 0
    ) as assigned_packers_count
FROM public.orders o
JOIN public.clients c ON o.client_id = c.id
WHERE o.production_status = 'pending'  -- Only show pending orders, not in_progress
AND o.commercial_status = 'approved';

-- 3. Ensure the updateProjectLead also updates order status if needed
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

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION update_project_lead_with_status(UUID, UUID) TO authenticated;
GRANT SELECT ON available_orders_for_assignment TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES (run these to test)
-- =====================================================

-- Check the function works
-- SELECT assign_packers_to_order('your-order-uuid', ARRAY['packer-uuid-1', 'packer-uuid-2']);

-- Check available orders (should exclude in_progress orders)
-- SELECT * FROM available_orders_for_assignment;

-- Check order status after assignment
-- SELECT id, order_name, production_status, project_lead_id FROM orders WHERE production_status = 'in_progress';
