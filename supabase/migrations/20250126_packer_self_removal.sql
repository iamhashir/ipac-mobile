-- Add packer self-removal functionality with validation
-- Packers can remove themselves from orders with proper lead assignment checks

-- Function to allow a packer to remove themselves from an order
CREATE OR REPLACE FUNCTION remove_self_from_order(order_uuid UUID, packer_uuid UUID)
RETURNS JSON AS $$
DECLARE
  packer_count INTEGER;
  lead_count INTEGER;
  is_packer_lead BOOLEAN;
  result JSON;
BEGIN
  -- Check if packer is assigned to this order
  IF NOT EXISTS (
    SELECT 1 FROM order_team_members
    WHERE order_id = order_uuid AND packer_id = packer_uuid
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'not_assigned',
      'message', 'You are not assigned to this order'
    );
  END IF;

  -- Count total packers
  SELECT COUNT(*) INTO packer_count
  FROM order_team_members
  WHERE order_id = order_uuid;

  -- Prevent removal if this is the last packer
  IF packer_count = 1 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'last_packer',
      'message', 'Cannot remove yourself as the last packer. Contact an admin.'
    );
  END IF;

  -- Check if packer is a lead
  SELECT is_team_lead INTO is_packer_lead
  FROM order_team_members
  WHERE order_id = order_uuid AND packer_id = packer_uuid;

  -- Count remaining leads (excluding current packer)
  SELECT COUNT(*) INTO lead_count
  FROM order_team_members
  WHERE order_id = order_uuid 
    AND packer_id != packer_uuid
    AND is_team_lead = TRUE;

  -- If packer is the last lead, prevent removal
  IF is_packer_lead AND lead_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'last_lead',
      'message', 'You are the last team lead. Please assign another team lead before leaving.',
      'remaining_packers', packer_count - 1
    );
  END IF;

  -- Remove the packer from the order
  DELETE FROM order_team_members
  WHERE order_id = order_uuid AND packer_id = packer_uuid;

  -- End any active sessions for this packer on this order
  UPDATE packer_sessions
  SET status = 'completed',
      end_time = NOW()
  WHERE order_id = order_uuid 
    AND packer_id = packer_uuid
    AND status = 'active';

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully removed from order',
    'was_lead', is_packer_lead
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION remove_self_from_order TO authenticated;

COMMENT ON FUNCTION remove_self_from_order IS 'Allows a packer to remove themselves from an order with proper validation for leads and last packer.';
