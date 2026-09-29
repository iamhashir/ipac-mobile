-- Fix order lock bug when last packer is removed
-- When the last packer is removed from an order, reset the order status to pending

-- Create a trigger function to handle empty orders
CREATE OR REPLACE FUNCTION handle_empty_order()
RETURNS TRIGGER AS $$
DECLARE
  packer_count INTEGER;
BEGIN
  -- Count remaining packers for the order
  SELECT COUNT(*)
  INTO packer_count
  FROM order_team_members
  WHERE order_id = OLD.order_id;

  -- If no packers remain, reset order status to pending
  IF packer_count = 0 THEN
    UPDATE orders
    SET production_status = 'pending',
        project_lead_id = NULL
    WHERE id = OLD.order_id
      AND production_status = 'in_progress';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on order_team_members deletion
DROP TRIGGER IF EXISTS trigger_handle_empty_order ON order_team_members;
CREATE TRIGGER trigger_handle_empty_order
AFTER DELETE ON order_team_members
FOR EACH ROW
EXECUTE FUNCTION handle_empty_order();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION handle_empty_order TO authenticated;

COMMENT ON FUNCTION handle_empty_order IS 'Resets order status to pending when the last packer is removed, preventing order lock.';
