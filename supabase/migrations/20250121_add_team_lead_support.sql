-- Add team lead support to order_team_members
ALTER TABLE order_team_members 
ADD COLUMN is_team_lead BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX idx_order_team_members_team_lead 
ON order_team_members(order_id, packer_id) 
WHERE is_team_lead = TRUE;

-- Function to check if user is team lead for an order
CREATE OR REPLACE FUNCTION is_team_lead_for_order(user_id UUID, order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM order_team_members otm
    WHERE otm.packer_id = user_id
      AND otm.order_id = order_uuid
      AND otm.is_team_lead = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign team lead
CREATE OR REPLACE FUNCTION assign_team_lead(order_uuid UUID, packer_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Remove any existing team leads for this order
  UPDATE order_team_members
  SET is_team_lead = FALSE
  WHERE order_id = order_uuid
    AND is_team_lead = TRUE;

  -- Set the new team lead
  UPDATE order_team_members
  SET is_team_lead = TRUE
  WHERE order_id = order_uuid
    AND packer_id = packer_uuid;
  
  -- If the packer is not already in the team, add them
  INSERT INTO order_team_members (order_id, packer_id, is_team_lead)
  VALUES (order_uuid, packer_uuid, TRUE)
  ON CONFLICT (order_id, packer_id) 
  DO UPDATE SET is_team_lead = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the can_user_mark_attendance function to include team leads
CREATE OR REPLACE FUNCTION can_user_mark_attendance(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is admin or director
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
  
  -- Check if user is team lead for this order
  RETURN is_team_lead_for_order(auth.uid(), order_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for attendance_logs
DROP POLICY IF EXISTS "Admin and directors can manage all attendance" ON attendance_logs;
DROP POLICY IF EXISTS "Project leads can manage attendance for their orders" ON attendance_logs;
DROP POLICY IF EXISTS "Packers can view their own attendance" ON attendance_logs;

-- New policies that include team leads
CREATE POLICY "Admin, directors and team leads can manage attendance"
ON attendance_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('admin', 'director')
      AND p.status = 'active'
  )
  OR is_team_lead_for_order(auth.uid(), order_id)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('admin', 'director')
      AND p.status = 'active'
  )
  OR is_team_lead_for_order(auth.uid(), order_id)
);

CREATE POLICY "Packers can view their own attendance"
ON attendance_logs
FOR SELECT
TO authenticated
USING (
  packer_id = auth.uid()
);

-- Update RLS policies for packer_sessions
DROP POLICY IF EXISTS "Admin and directors can manage all sessions" ON packer_sessions;
DROP POLICY IF EXISTS "Project leads can manage sessions" ON packer_sessions;
DROP POLICY IF EXISTS "Packers can view their own sessions" ON packer_sessions;

-- New policies that include team leads
CREATE POLICY "Admin, directors and team leads can manage sessions"
ON packer_sessions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name IN ('admin', 'director')
      AND p.status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM order_team_members otm
    WHERE otm.packer_id = auth.uid()
      AND otm.is_team_lead = TRUE
      AND EXISTS (
        SELECT 1
        FROM orders o
        WHERE o.id = otm.order_id
          AND o.status IN ('pending', 'in_progress')
      )
  )
);

CREATE POLICY "Packers can view their own sessions"
ON packer_sessions
FOR SELECT
TO authenticated
USING (
  packer_id = auth.uid()
);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_team_lead_for_order TO authenticated;
GRANT EXECUTE ON FUNCTION assign_team_lead TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_mark_attendance TO authenticated;

-- Add comment to explain the team lead concept
COMMENT ON COLUMN order_team_members.is_team_lead IS 'Temporary team lead status for this packer on this specific order';
