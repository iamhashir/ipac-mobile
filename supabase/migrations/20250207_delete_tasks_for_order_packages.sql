-- RPC function to delete task_logs associated with order_packages
-- This function bypasses RLS policies (SECURITY DEFINER) to allow admin users to reset packer data
-- CASCADE rules will automatically delete task_packages and task_assignments when task_logs are deleted

CREATE OR REPLACE FUNCTION delete_tasks_for_order_packages(package_ids UUID[])
RETURNS VOID AS $$
BEGIN
  -- Security check: Only admin role can delete tasks
  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND r.name = 'admin'
      AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only admin users can delete task logs';
  END IF;

  -- Delete task_logs that are associated with the given order_packages
  -- The CASCADE foreign key constraints will automatically delete:
  --   - task_packages (via task_packages.task_log_id FK)
  --   - task_assignments (via task_assignments.task_id FK)
  DELETE FROM task_logs
  WHERE id IN (
    SELECT DISTINCT task_log_id
    FROM task_packages
    WHERE order_package_id = ANY(package_ids)
      AND task_log_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
-- RLS will be checked at the application level (admin panel only)
GRANT EXECUTE ON FUNCTION delete_tasks_for_order_packages TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION delete_tasks_for_order_packages IS 
'Deletes all task_logs associated with the given order_packages. Used by reset_packer_data functionality. CASCADE rules automatically delete task_packages and task_assignments.';
