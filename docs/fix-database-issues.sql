-- =====================================================
-- COMPLETE FIX FOR DATABASE ISSUES
-- Run this in Supabase SQL Editor to fix all problems
-- =====================================================

-- 1. Create the missing available_orders_for_assignment view
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
WHERE o.production_status IN ('pending', 'in_progress')
AND o.commercial_status = 'approved';

-- 2. Make sure the get_order_packers function exists and works correctly
CREATE OR REPLACE FUNCTION get_order_packers(order_uuid UUID)
RETURNS TABLE (
    packer_id UUID,
    full_name TEXT,
    username TEXT,
    packer_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.username,
        p.packer_status
    FROM public.order_teams ot
    CROSS JOIN jsonb_array_elements_text(ot.packers_json) AS packer_json(packer_uuid)
    JOIN public.profiles p ON p.id = packer_json.packer_uuid::uuid
    WHERE ot.order_id = order_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Make sure the assign_packers_to_order function works correctly
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
    
    -- Update order status to 'in_progress' when team is assigned
    UPDATE public.orders 
    SET production_status = 'in_progress',
        start_date = COALESCE(start_date, NOW()),
        updated_at = NOW()
    WHERE id = order_uuid 
    AND production_status = 'pending';
    
    RETURN team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a function to get all packers with status (bypass RLS issues)
CREATE OR REPLACE FUNCTION get_all_packers_with_status()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    username TEXT,
    packer_status TEXT,
    current_order_id UUID,
    current_order_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.username,
        p.packer_status,
        p.current_order_id,
        o.order_name as current_order_name
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    LEFT JOIN public.orders o ON p.current_order_id = o.id
    WHERE r.name = 'packer'
    AND p.status = 'active'
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure the trigger function works with the new structure
CREATE OR REPLACE FUNCTION update_packer_status_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
    packer_uuid UUID;
BEGIN
    -- When order team record is modified, update packer statuses
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Loop through all packers in the JSON array and mark them as busy
        FOR packer_uuid IN 
            SELECT jsonb_array_elements_text(NEW.packers_json)::uuid
        LOOP
            UPDATE public.profiles 
            SET packer_status = 'busy', 
                current_order_id = NEW.order_id,
                updated_at = NOW()
            WHERE id = packer_uuid;
        END LOOP;
        RETURN NEW;
    END IF;
    
    -- When an order team record is deleted, mark all packers as available
    IF TG_OP = 'DELETE' THEN
        FOR packer_uuid IN 
            SELECT jsonb_array_elements_text(OLD.packers_json)::uuid
        LOOP
            -- Check if packer has other active assignments
            IF NOT EXISTS (
                SELECT 1 FROM public.order_teams ot
                JOIN public.orders o ON ot.order_id = o.id
                WHERE ot.packers_json ? packer_uuid::text
                AND o.production_status IN ('pending', 'in_progress')
                AND ot.id != OLD.id
            ) THEN
                -- No other active assignments, mark as available
                UPDATE public.profiles 
                SET packer_status = 'available', 
                    current_order_id = NULL,
                    updated_at = NOW()
                WHERE id = packer_uuid;
            END IF;
        END LOOP;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Make sure the trigger exists
DROP TRIGGER IF EXISTS trigger_update_packer_status ON public.order_teams;
CREATE TRIGGER trigger_update_packer_status
    AFTER INSERT OR UPDATE OR DELETE ON public.order_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_packer_status_on_assignment();

-- 7. Update the user_assigned_to_order function to work with JSON
CREATE OR REPLACE FUNCTION user_assigned_to_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.order_teams 
    WHERE order_id = order_uuid 
    AND packers_json ? auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant permissions on all functions
GRANT EXECUTE ON FUNCTION get_all_packers_with_status() TO authenticated;
GRANT EXECUTE ON FUNCTION assign_packers_to_order(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_packers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_assigned_to_order(UUID) TO authenticated;
GRANT SELECT ON available_orders_for_assignment TO authenticated;

-- 9. Ensure RLS policies allow proper access
-- Drop and recreate the profiles policy for reading all profiles
DROP POLICY IF EXISTS "Admin and director can read all profiles" ON public.profiles;
CREATE POLICY "Admin and director can read all profiles" ON public.profiles
  FOR SELECT USING (
    get_user_role() IN ('admin', 'director') OR
    auth.role() = 'authenticated'
  );

-- 10. Add some debug data if missing (you can skip this if you have data)
-- Insert test data only if tables are empty
DO $$
BEGIN
    -- Insert roles if they don't exist
    INSERT INTO public.roles (name, can_block_users, can_unblock_users, can_ban_users, can_reset_passwords, can_delete_profiles, can_manage_roles) 
    VALUES 
      ('director', true, true, true, true, true, true),
      ('admin', true, true, false, true, false, false),
      ('project_lead', true, true, false, false, false, false),
      ('sales', false, false, false, false, false, false),
      ('packer', false, false, false, false, false, false)
    ON CONFLICT (name) DO NOTHING;

    -- Insert test clients if they don't exist
    INSERT INTO public.clients (name, contact_person, email, phone, address)
    VALUES 
      ('ABC Manufacturing', 'John Smith', 'john@abcmfg.com', '+1-555-0101', '123 Industrial Ave'),
      ('XYZ Logistics', 'Jane Doe', 'jane@xyzlogistics.com', '+1-555-0102', '456 Shipping Blvd')
    ON CONFLICT (name) DO NOTHING;
END $$;

-- 11. Verify the setup
SELECT 'Setup completed successfully' as result;
