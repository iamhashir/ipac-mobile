-- Alternative Fix: Allow all team members to mark attendance
-- This modifies the can_user_mark_attendance function to allow all assigned packers

CREATE OR REPLACE FUNCTION can_user_mark_attendance(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is admin or director (full access)
  IF EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('admin', 'director')
      AND p.status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is team lead for this order (existing functionality)
  IF is_team_lead_for_order(auth.uid(), order_uuid) THEN
    RETURN TRUE;
  END IF;
  
  -- NEW: Allow all team members assigned to this order to mark attendance
  IF EXISTS (
    SELECT 1
    FROM order_team_members otm
    WHERE otm.order_id = order_uuid
      AND otm.packer_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- If none of the above conditions are met, deny access
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION can_user_mark_attendance TO authenticated;

-- Add comment explaining the updated behavior
COMMENT ON FUNCTION can_user_mark_attendance IS 'Updated to allow all team members assigned to an order to mark attendance, not just team leads';