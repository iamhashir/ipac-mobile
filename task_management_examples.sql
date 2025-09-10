-- Task Management System - Complete Usage Examples
-- This file demonstrates all functionality of the task management system

-- ==============================================
-- 1. VIEW CURRENT STATE
-- ==============================================

-- View all tasks with their current status
SELECT * FROM task_management_view ORDER BY display_status, created_at;

-- View packer availability
SELECT * FROM packer_availability_view;

-- ==============================================
-- 2. CREATING NEW TASKS
-- ==============================================

-- Step 1: Create a new task assignment
INSERT INTO task_assignment (task_name, assigned_packers, securing_foreign_key)
VALUES (
    'New Manufacturing Task', 
    ARRAY[(SELECT id FROM packers WHERE name = 'John Doe')], 
    'security-key-new-001'
);

-- Step 2: Create task log for the assigned packer
INSERT INTO task_logs (task_assignment_id, packer_id)
SELECT 
    ta.id,
    ta.assigned_packers[1]
FROM task_assignment ta
WHERE ta.task_name = 'New Manufacturing Task'
  AND ta.securing_foreign_key = 'security-key-new-001';

-- ==============================================
-- 3. TASK LIFECYCLE OPERATIONS
-- ==============================================

-- Get a task log ID for testing (replace with actual ID)
SELECT 
    tl.id as task_log_id,
    ta.task_name,
    ta.task_status
FROM task_logs tl
JOIN task_assignment ta ON tl.task_assignment_id = ta.id
WHERE ta.task_name = 'New Manufacturing Task';

-- Example operations (replace 'your-task-log-id' with actual UUID):

-- 3.1 PAUSE A TASK
-- Application should record pause start time, then call:
-- SELECT pause_task('your-task-log-id');

-- 3.2 RESUME A TASK (with pause duration tracking)
-- Application provides the recorded pause start time:
-- SELECT resume_task('your-task-log-id', '2025-01-01 10:30:00+00');

-- 3.3 FINISH A TASK
-- This calculates duration and marks task as completed:
-- SELECT finish_task('your-task-log-id');

-- 3.4 RESTART A COMPLETED TASK
-- This returns true if successful, false if packers are busy:
-- SELECT restart_task('your-task-log-id');

-- 3.5 EDIT A TASK (increment update counter)
-- Call this whenever task details are modified:
-- SELECT increment_task_update_counter('your-task-log-id');

-- ==============================================
-- 4. UI DATA QUERIES
-- ==============================================

-- Get data for the main task management table
-- This query provides all data needed for the UI
SELECT 
    task_log_id,
    task_name,
    packer_name,
    start_time,
    end_time,
    duration,
    display_status,
    can_restart,
    securing_foreign_key,
    -- Format times for display
    TO_CHAR(start_time, 'HH12:MI AM') as formatted_start_time,
    CASE 
        WHEN end_time IS NOT NULL 
        THEN TO_CHAR(end_time, 'HH12:MI AM')
        ELSE '—'
    END as formatted_end_time,
    duration || ' min' as formatted_duration
FROM task_management_view
ORDER BY 
    -- Completed tasks go to bottom
    CASE WHEN display_status = 'completed' THEN 1 ELSE 0 END,
    created_at DESC;

-- Get packer availability for assignment dropdowns
SELECT 
    id,
    name,
    is_available,
    active_task_count,
    status
FROM packer_availability_view
ORDER BY is_available DESC, name;

-- ==============================================
-- 5. BUSINESS LOGIC CHECKS
-- ==============================================

-- Check if specific packers are available for restart
-- (This logic is built into the restart_task function)
SELECT 
    p.name,
    p.status,
    CASE WHEN p.status = 'busy' THEN 'Not Available' ELSE 'Available' END as availability
FROM packers p
WHERE p.id = ANY(ARRAY['packer-uuid-1', 'packer-uuid-2']); -- Replace with actual UUIDs

-- Get tasks that can be restarted (all assigned packers available)
SELECT 
    tm.task_log_id,
    tm.task_name,
    tm.packer_name,
    tm.can_restart
FROM task_management_view tm
WHERE tm.display_status = 'completed'
  AND tm.can_restart = true;

-- ==============================================
-- 6. REPORTING QUERIES
-- ==============================================

-- Task completion summary
SELECT 
    task_name,
    COUNT(*) as total_instances,
    AVG(duration) as avg_duration_minutes,
    SUM(duration) as total_duration_minutes,
    AVG(pause_duration) as avg_pause_duration_seconds
FROM task_management_view
WHERE display_status = 'completed'
GROUP BY task_name
ORDER BY total_duration_minutes DESC;

-- Packer productivity
SELECT 
    packer_name,
    COUNT(*) as completed_tasks,
    AVG(duration) as avg_task_duration_minutes,
    SUM(duration) as total_work_minutes,
    AVG(update_counter) as avg_edits_per_task
FROM task_management_view
WHERE display_status = 'completed'
GROUP BY packer_name, packer_id
ORDER BY total_work_minutes DESC;

-- Daily task activity
SELECT 
    DATE(created_at) as work_date,
    COUNT(*) as tasks_started,
    COUNT(CASE WHEN display_status = 'completed' THEN 1 END) as tasks_completed,
    AVG(duration) as avg_duration_minutes
FROM task_management_view
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY work_date DESC;

-- ==============================================
-- 7. MAINTENANCE QUERIES
-- ==============================================

-- Clean up very old completed tasks (optional)
-- DELETE FROM task_logs 
-- WHERE id IN (
--     SELECT tl.id 
--     FROM task_logs tl
--     JOIN task_assignment ta ON tl.task_assignment_id = ta.id
--     WHERE ta.task_status = 'completed'
--       AND tl.updated_at < NOW() - INTERVAL '90 days'
-- );

-- Update packer status (for admin use)
-- UPDATE packers 
-- SET status = 'available' 
-- WHERE status = 'busy' 
--   AND id NOT IN (
--       SELECT DISTINCT tl.packer_id
--       FROM task_logs tl
--       JOIN task_assignment ta ON tl.task_assignment_id = ta.id
--       WHERE ta.task_status IN ('in_progress', 'paused')
--   );

-- ==============================================
-- 8. EXAMPLE WORKFLOW
-- ==============================================

/*
Complete workflow example:

1. Create task assignment and task log (as shown above)

2. Packer starts working (task is automatically in 'in_progress' state)

3. Packer pauses work:
   - App records pause_start_time = NOW()
   - Call: SELECT pause_task('task-log-id');

4. Packer resumes work:
   - Call: SELECT resume_task('task-log-id', pause_start_time);

5. Packer edits task details:
   - Call: SELECT increment_task_update_counter('task-log-id');

6. Packer finishes task:
   - Call: SELECT finish_task('task-log-id');
   - Task status becomes 'completed'
   - Row should be grayed out in UI
   - Show only "Restart" button

7. Packer wants to restart:
   - Call: SELECT restart_task('task-log-id');
   - If returns false: Alert "Please wait for packers to be available"
   - If returns true: Task is restarted successfully

8. On subsequent finish:
   - Duration accumulates (previous + new session)
   - Process can repeat indefinitely
*/
