-- =====================================================
-- QUICK FIX: CREATE THE assign_packers_to_order FUNCTION
-- Run this in Supabase SQL Editor immediately to fix the 404 error
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

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_packers_to_order(UUID, UUID[]) TO authenticated;

-- Success message
SELECT 'assign_packers_to_order function created successfully!' as status;
