-- =====================================================
-- DATABASE RESTRUCTURE: ORDER TEAMS TABLE
-- Remove available_orders_for_assignment table and update order_teams
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. First, drop the dependent view
DROP VIEW IF EXISTS available_orders_for_assignment;

-- 2. Drop existing constraints on order_teams table
ALTER TABLE public.order_teams DROP CONSTRAINT IF EXISTS order_teams_pkey;

-- 3. Add UUID primary key and restructure order_teams table
ALTER TABLE public.order_teams 
ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS packers_json JSONB DEFAULT '[]'::jsonb;

-- 4. Create a function to migrate existing order_teams data to JSON format
CREATE OR REPLACE FUNCTION migrate_order_teams_to_json()
RETURNS void AS $$
DECLARE
    order_record RECORD;
    packers_array JSONB := '[]'::jsonb;
    packer_record RECORD;
BEGIN
    -- For each unique order_id, collect all packer_ids into JSON array
    FOR order_record IN 
        SELECT DISTINCT order_id FROM public.order_teams
    LOOP
        -- Reset packers array for this order
        packers_array := '[]'::jsonb;
        
        -- Collect all packers for this order
        FOR packer_record IN 
            SELECT packer_id FROM public.order_teams WHERE order_id = order_record.order_id
        LOOP
            packers_array := packers_array || jsonb_build_array(packer_record.packer_id);
        END LOOP;
        
        -- Update the first record for this order with the JSON array
        UPDATE public.order_teams 
        SET packers_json = packers_array
        WHERE order_id = order_record.order_id 
        AND id = (
            SELECT id FROM public.order_teams 
            WHERE order_id = order_record.order_id 
            LIMIT 1
        );
        
        -- Delete duplicate records for this order (keep only one)
        DELETE FROM public.order_teams 
        WHERE order_id = order_record.order_id 
        AND id NOT IN (
            SELECT id FROM public.order_teams 
            WHERE order_id = order_record.order_id 
            LIMIT 1
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Run the migration function
SELECT migrate_order_teams_to_json();

-- 6. Drop the old packer_id column (no longer needed since we use JSON)
ALTER TABLE public.order_teams DROP COLUMN IF EXISTS packer_id;

-- 7. Add proper constraints and indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_teams_order_id ON public.order_teams(order_id);
CREATE INDEX IF NOT EXISTS idx_order_teams_packers_json ON public.order_teams USING GIN(packers_json);

-- 8. Update the packer status update function to work with new structure
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

-- 9. Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_packer_status ON public.order_teams;
CREATE TRIGGER trigger_update_packer_status
    AFTER INSERT OR UPDATE OR DELETE ON public.order_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_packer_status_on_assignment();

-- 10. Update the user_assigned_to_order function to work with JSON
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

-- 11. Create helper functions for working with the new structure
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
        SET packers_json = packers_json, updated_at = NOW()
        WHERE id = team_id;
    ELSE
        -- Create new team
        INSERT INTO public.order_teams (order_id, packers_json)
        VALUES (order_uuid, packers_json)
        RETURNING id INTO team_id;
    END IF;
    
    RETURN team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create function to get packers for an order
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

-- 13. Recreate the available orders view (simplified without the table dependency)
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

-- 14. Update RLS policies to work with new structure
DROP POLICY IF EXISTS "Admin roles can read order_teams" ON public.order_teams;
CREATE POLICY "Admin roles can read order_teams" ON public.order_teams
  FOR SELECT USING (get_user_role() IN ('admin', 'director', 'project_lead'));

DROP POLICY IF EXISTS "Packers can read own order_teams" ON public.order_teams;
CREATE POLICY "Packers can read own order_teams" ON public.order_teams
  FOR SELECT USING (
    get_user_role() = 'packer' AND packers_json ? auth.uid()::text
  );

DROP POLICY IF EXISTS "Admin roles can modify order_teams" ON public.order_teams;
CREATE POLICY "Admin roles can modify order_teams" ON public.order_teams
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- 15. Grant permissions on new functions
GRANT EXECUTE ON FUNCTION assign_packers_to_order(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_packers(UUID) TO authenticated;
GRANT SELECT ON available_orders_for_assignment TO authenticated;

-- 16. Clean up the migration function
DROP FUNCTION IF EXISTS migrate_order_teams_to_json();

-- 17. Add comments for documentation
COMMENT ON COLUMN public.order_teams.id IS 'UUID primary key for the order team';
COMMENT ON COLUMN public.order_teams.packers_json IS 'JSON array containing UUIDs of all packers assigned to this order';
COMMENT ON TABLE public.order_teams IS 'Stores team assignments for orders with packers stored as JSON array';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check the new structure
-- SELECT * FROM public.order_teams;

-- Test getting packers for an order
-- SELECT * FROM get_order_packers('your-order-uuid-here');

-- Check available orders
-- SELECT * FROM available_orders_for_assignment;
