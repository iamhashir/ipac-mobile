-- Enable packers to fully release a project and automatically clean up task assignments.
-- Adds helpers to surface in-flight tasks per packer so the UI can prompt before removal.

-- Helper to list active tasks for a set of packers within an order
CREATE OR REPLACE FUNCTION get_active_tasks_for_packers(order_uuid UUID, packer_ids UUID[])
RETURNS TABLE (
  task_log_id UUID,
  task_name TEXT,
  packer_id UUID,
  task_status TEXT,
  package_numbers TEXT[]
) AS $$
BEGIN
  IF packer_ids IS NULL OR array_length(packer_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    tl.id AS task_log_id,
    t.name AS task_name,
    ta.packer_id,
    ta.task_status::text,
  ARRAY_AGG(DISTINCT op.package_number ORDER BY op.package_number) AS package_numbers
  FROM task_assignments ta
  JOIN task_logs tl ON tl.id = ta.task_id
  JOIN tasks t ON t.id = tl.task_id
  JOIN task_packages tp ON tp.task_log_id = tl.id
  JOIN order_packages op ON op.id = tp.order_package_id
  WHERE op.order_id = order_uuid
    AND ta.packer_id = ANY(packer_ids)
    AND ta.task_status != 'completed'
  GROUP BY tl.id, t.name, ta.packer_id, ta.task_status;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_active_tasks_for_packers TO authenticated;

COMMENT ON FUNCTION get_active_tasks_for_packers IS 'Returns active task summaries (with boxes) for the specified packers on an order.';

-- Helper to mark all of a packer''s assignments on an order as completed
CREATE OR REPLACE FUNCTION complete_assignments_for_packers(order_uuid UUID, packer_ids UUID[])
RETURNS JSON AS $$
DECLARE
  affected INTEGER := 0;
BEGIN
  IF packer_ids IS NULL OR array_length(packer_ids, 1) IS NULL THEN
    RETURN json_build_object('updated_assignments', 0);
  END IF;

  UPDATE task_assignments ta
  SET task_status = 'completed'
  FROM task_logs tl
  JOIN task_packages tp ON tp.task_log_id = tl.id
  JOIN order_packages op ON op.id = tp.order_package_id
  WHERE ta.task_id = tl.id
    AND op.order_id = order_uuid
    AND ta.packer_id = ANY(packer_ids)
    AND ta.task_status != 'completed';

  GET DIAGNOSTICS affected = ROW_COUNT;

  RETURN json_build_object('updated_assignments', affected);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_assignments_for_packers TO authenticated;

COMMENT ON FUNCTION complete_assignments_for_packers IS 'Marks every non-completed task assignment for the given packers as completed for a specific order.';

-- Allow the last remaining packer (or lead) to remove themselves while keeping progress intact.
CREATE OR REPLACE FUNCTION remove_self_from_order(order_uuid UUID, packer_uuid UUID)
RETURNS JSON AS $$
DECLARE
  packer_record RECORD;
  remaining_count INTEGER := 0;
  was_lead BOOLEAN := FALSE;
BEGIN
  SELECT otm.is_team_lead, otm.is_project_lead
  INTO packer_record
  FROM order_team_members otm
  WHERE otm.order_id = order_uuid AND otm.packer_id = packer_uuid;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'not_assigned',
      'message', 'You are not assigned to this order'
    );
  END IF;

  was_lead := COALESCE(packer_record.is_team_lead, FALSE)
    OR COALESCE(packer_record.is_project_lead, FALSE);

  -- Clean up any active assignments before releasing the packer
  PERFORM complete_assignments_for_packers(order_uuid, ARRAY[packer_uuid]);

  -- Remove from team roster
  DELETE FROM order_team_members
  WHERE order_id = order_uuid AND packer_id = packer_uuid;

  -- Drop any active session rows for this packer/order combo
  DELETE FROM packer_sessions
  WHERE order_id = order_uuid AND packer_id = packer_uuid;

  -- Return packer to available pool
  UPDATE profiles
  SET packer_status = 'available',
      current_order_id = NULL
  WHERE id = packer_uuid;

  -- Count remaining packers for informational purposes
  SELECT COUNT(*) INTO remaining_count
  FROM order_team_members
  WHERE order_id = order_uuid;

  RETURN json_build_object(
    'success', true,
    'remaining_packers', remaining_count,
    'was_lead', was_lead
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION remove_self_from_order TO authenticated;

COMMENT ON FUNCTION remove_self_from_order IS 'Removes the requesting packer from an order, even if they are the final assignee, while preserving existing work.';
