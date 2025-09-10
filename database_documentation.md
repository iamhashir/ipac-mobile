# Database Documentation - Task Management System

## Overview
This document provides comprehensive documentation for the task management system database schema, including tables, relationships, functions, and business logic.

## Tables

### packers
Stores packer information and availability status.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Unique identifier for the packer |
| name | text | Packer's full name |
| email | text (UNIQUE) | Packer's email address |
| status | text | Current availability status (available, busy, break) |
| created_at | timestamptz | Record creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Constraints:**
- `status` must be one of: 'available', 'busy', 'break'

### task_assignment
Stores task assignments and their current status.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Unique identifier for the task assignment |
| task_name | text | Name/description of the task |
| task_status | text | Current status of the task (pending, in_progress, completed, paused) |
| assigned_packers | uuid[] | Array of packer UUIDs assigned to this task |
| securing_foreign_key | text | Stores the originally chosen foreign key value for securing |
| created_at | timestamptz | Record creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Constraints:**
- `task_status` must be one of: 'pending', 'in_progress', 'completed', 'paused'

**Business Rules:**
- For completed tasks, the row should be grayed out in the UI
- The task dropdown should be grayed out and disabled when editing
- All fields except the task dropdown should be editable in the task tab
- The foreign key selection for securing should display the originally chosen value instead of default 'select'

### task_logs
Stores detailed logs of task execution by packers with timing and duration tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Unique identifier for the task log |
| task_assignment_id | uuid (FK) | Reference to task_assignment table |
| packer_id | uuid (FK) | Reference to packers table |
| start_time | timestamptz | Initial start time when task was first created (never updated after creation) |
| end_time | timestamptz | End time when task was finished (cleared on restart) |
| restart_time | timestamptz | Time when task was last restarted (updated each restart) |
| duration | integer | Cumulative duration in minutes (adds time from each completion) |
| pause_duration | integer | Total pause duration in seconds |
| update_counter | integer | Incremented by 1 each time the task is edited |
| created_at | timestamptz | Record creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Foreign Keys:**
- `task_assignment_id` → `task_assignment(id)` ON DELETE CASCADE
- `packer_id` → `packers(id)` ON DELETE CASCADE

## Duration Calculation Logic

### First Task Completion
- Duration = `end_time - start_time` (in minutes)
- `duration` column stores this calculated value

### Task Restart and Subsequent Completions
1. **On Restart:**
   - Set `restart_time = now()`
   - Clear `end_time = NULL`
   - Change `task_status` to 'in_progress'

2. **On Completion After Restart:**
   - Duration = `end_time - restart_time` (in minutes)
   - Add this duration to existing `duration` column value
   - `start_time` is never used again after the first completion

### Pause Duration Tracking
- When task is paused, record the pause start time in the application
- When resumed, calculate pause duration in seconds: `now() - pause_start_time`
- Add calculated pause duration to `pause_duration` column

## Database Functions

### finish_task(task_log_id uuid)
Completes a task, calculates duration based on current state, and updates status.

**Logic:**
- If `restart_time` is not null: duration = `now() - restart_time`
- If `restart_time` is null: duration = `now() - start_time` (first completion)
- Adds calculated duration to existing duration value
- Sets `end_time = now()`
- Updates task_assignment status to 'completed'

### restart_task(task_log_id uuid) → boolean
Restarts a completed task if all assigned packers are available.

**Logic:**
- Checks if any assigned packers have status = 'busy'
- Returns false if any packers are busy (user should be alerted)
- If all packers available:
  - Sets `restart_time = now()`
  - Clears `end_time = NULL`
  - Updates task_assignment status to 'in_progress'
  - Returns true

### pause_task(task_log_id uuid)
Pauses an active task.

**Logic:**
- Updates task_assignment status to 'paused'

### resume_task(task_log_id uuid, pause_start_time timestamptz)
Resumes a paused task and records pause duration.

**Logic:**
- Calculates pause duration: `now() - pause_start_time` (in seconds)
- Adds to existing `pause_duration` value
- Updates task_assignment status to 'in_progress'

### increment_task_update_counter(task_log_id uuid)
Increments the update counter when a task is edited.

**Logic:**
- Increments `update_counter` by 1
- Called whenever task details are modified

## Views

### task_management_view
Comprehensive view for the task management UI with all necessary data and computed fields.

**Key Computed Fields:**
- `display_status`: Determines UI display status based on end_time and task_status
- `can_restart`: Boolean indicating if task can be restarted (all packers available)

### packer_availability_view
Shows packer availability and current workload.

**Key Computed Fields:**
- `is_available`: Boolean based on status
- `active_task_count`: Count of in_progress and paused tasks for the packer

## UI Business Rules

### Task Tab Persistence
- Task tab remains persistent until the task is completed
- Packer can edit task via dedicated tab or by pressing the row
- Once completed, task is placed below all other active tasks

### Task Row Display Rules
- **Active Tasks**: Show start/pause buttons, normal styling
- **Completed Tasks**: 
  - Gray out the entire row
  - Remove start and pause buttons
  - Show only "Restart" button
  - Restart button should check packer availability before allowing restart

### Button Behavior
- **Finish Button**: Calls `finish_task()` function
- **Restart Button**: Calls `restart_task()` function, alerts user if packers busy
- **Pause Button**: Records pause start time, calls `pause_task()` function  
- **Resume Button**: Calls `resume_task()` with recorded pause start time

### Foreign Key Selection
- The securing foreign key dropdown should display the originally chosen value
- Instead of showing default 'select', show the actual selected value from `securing_foreign_key` column

## Additional Features
- Additional packers can be assigned automatically without requiring a button
- Update triggers automatically maintain `updated_at` timestamps
- Row Level Security (RLS) is enabled on all tables for security

## Usage Examples

```sql
-- Create a new task assignment
INSERT INTO task_assignment (task_name, assigned_packers, securing_foreign_key)
VALUES ('Base Manufacture', ARRAY['packer-uuid-1', 'packer-uuid-2'], 'securing-key-123');

-- Create task log for a packer
INSERT INTO task_logs (task_assignment_id, packer_id)
VALUES ('task-assignment-uuid', 'packer-uuid-1');

-- Finish a task
SELECT finish_task('task-log-uuid');

-- Restart a task (check return value)
SELECT restart_task('task-log-uuid'); -- Returns true if successful, false if packers busy

-- Pause and resume with duration tracking
SELECT pause_task('task-log-uuid');
-- Record pause start time in application, then:
SELECT resume_task('task-log-uuid', '2025-01-01 10:30:00+00');

-- Get data for UI
SELECT * FROM task_management_view;
SELECT * FROM packer_availability_view;
```

## Security
- All tables have Row Level Security (RLS) enabled
- Cascade deletes ensure data consistency
- Update triggers maintain data integrity
