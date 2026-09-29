-- Add support for multiple team leads per order
-- This migration enhances the existing single-lead system to support multiple leads

-- Update the comment to reflect multiple leads are now supported
COMMENT ON COLUMN order_team_members.is_team_lead IS 'Team lead status for this packer on this specific order. Multiple leads are supported per order.';

-- Create new function to add a team lead (without removing existing leads)
CREATE OR REPLACE FUNCTION add_team_lead(order_uuid UUID, packer_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Set the new team lead (keeps existing leads)
  UPDATE order_team_members
  SET is_team_lead = TRUE
  WHERE order_id = order_uuid
    AND packer_id = packer_uuid;
  
  -- If the packer is not already in the team, add them as a lead
  INSERT INTO order_team_members (order_id, packer_id, is_team_lead)
  VALUES (order_uuid, packer_uuid, TRUE)
  ON CONFLICT (order_id, packer_id) 
  DO UPDATE SET is_team_lead = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to remove a specific team lead
CREATE OR REPLACE FUNCTION remove_team_lead(order_uuid UUID, packer_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE order_team_members
  SET is_team_lead = FALSE
  WHERE order_id = order_uuid
    AND packer_id = packer_uuid
    AND is_team_lead = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get all team leads for an order
CREATE OR REPLACE FUNCTION get_order_team_leads(order_uuid UUID)
RETURNS TABLE (
  packer_id UUID,
  full_name TEXT,
  username TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    otm.packer_id,
    p.full_name,
    p.username
  FROM order_team_members otm
  JOIN profiles p ON p.id = otm.packer_id
  WHERE otm.order_id = order_uuid
    AND otm.is_team_lead = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the assign_team_lead function to keep backward compatibility
-- but now it clears all leads first (single lead behavior)
-- Users can use add_team_lead for multiple lead support
COMMENT ON FUNCTION assign_team_lead IS 'Assigns a single team lead, removing all other leads (backward compatible). Use add_team_lead for multiple leads.';

-- Create function to check if an order has at least one team lead
CREATE OR REPLACE FUNCTION order_has_team_lead(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM order_team_members
    WHERE order_id = order_uuid
      AND is_team_lead = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get count of team leads for an order
CREATE OR REPLACE FUNCTION count_order_team_leads(order_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM order_team_members
    WHERE order_id = order_uuid
      AND is_team_lead = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_team_lead TO authenticated;
GRANT EXECUTE ON FUNCTION remove_team_lead TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_team_leads TO authenticated;
GRANT EXECUTE ON FUNCTION order_has_team_lead TO authenticated;
GRANT EXECUTE ON FUNCTION count_order_team_leads TO authenticated;
