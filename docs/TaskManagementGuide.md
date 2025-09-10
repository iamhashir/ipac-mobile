# IPAC Task Management System

## Overview

This document describes the rule-based task management system implemented for the IPAC Operations App. The system follows specific business rules for task completion, pausing, and resuming as outlined in the user requirements.

## Business Rules Implemented

### 1. Task Completion Behavior
- ✅ **Completed tasks**: Row is grayed out, start/pause buttons are removed, only resume button is clickable
- ✅ **Task assignments**: Properly updated to "completed" status when task is finished
- ✅ **Duration tracking**: Accurate calculation of task duration including pause times

### 2. Task Resume Logic
- ✅ **Packer availability check**: When resuming, system checks if all assigned packers are free
- ✅ **Conflict handling**: If packers are busy, user is alerted with option to create new task with available packers
- ✅ **Automatic assignment updates**: Resume sets assignments back to "in_progress"

### 3. Task Tab Persistence
- ✅ **Tab persistence**: Task tabs remain until task completion
- ✅ **Field editability**: All fields except task dropdown are editable
- ✅ **Task dropdown**: Grayed out and disabled during editing
- ✅ **Auto packer assignment**: Additional packers can be assigned automatically

### 4. Pause Duration Tracking
- ✅ **Pause recording**: Pause button records duration in seconds
- ✅ **Resume tracking**: Pause duration saved in task_log's pause_duration field
- ✅ **Update counter**: Incremented on each pause/resume/edit operation

## Database Functions

### Core Functions

#### `can_resume_task(task_log_id UUID)`
Checks if a completed task can be resumed by verifying packer availability.

**Returns:**
```json
{
  "can_resume": true/false,
  "busy_packers": [...],
  "message": "Status message"
}
```

#### `resume_task(task_log_id UUID)`
Resumes a completed task after checking packer availability.

**Returns:**
```json
{
  "success": true/false,
  "message": "Status message"
}
```

#### `complete_task(task_log_id UUID)`
Properly completes a task, updating duration and assignment status.

**Returns:**
```json
{
  "success": true,
  "message": "Task completed successfully",
  "duration_minutes": 45.5
}
```

#### `pause_task(task_log_id UUID)`
Pauses an active task and updates assignment status.

**Returns:**
```json
{
  "success": true,
  "message": "Task paused successfully",
  "pause_start_time": "2025-09-04T16:30:00Z",
  "accumulated_minutes": 30.5
}
```

#### `unpause_task(task_log_id UUID, pause_duration_seconds NUMERIC)`
Resumes a paused task and optionally records pause duration.

**Returns:**
```json
{
  "success": true,
  "message": "Task resumed from pause",
  "restart_time": "2025-09-04T16:35:00Z"
}
```

### Database View

#### `task_status_view`
Comprehensive view showing current status of all tasks with:
- Task details (name, times, duration)
- Overall status (in_progress, paused, completed)
- Assigned packers with their individual status
- Linked packages
- Update counter for change tracking

## Client API Methods

### Supabase Client Integration

```typescript
import { db } from '../utils/api/supabase';

// Check if task can be resumed
const { data, error } = await db.canResumeTask(taskLogId);

// Resume a completed task
const { data, error } = await db.resumeTask(taskLogId);

// Complete a task
const { data, error } = await db.completeTask(taskLogId);

// Pause a task
const { data, error } = await db.pauseTask(taskLogId);

// Resume from pause
const { data, error } = await db.unpauseTask(taskLogId, pauseDurationSeconds);

// Get task status view
const { data, error } = await db.getTaskStatusView(taskLogIds);

// Get active tasks for packages
const { data, error } = await db.getActiveTasksForPackages(orderPackageIds);
```

## UI Implementation

### Task Row Styling

```typescript
const getTaskRowStyle = (status: string) => {
  switch (status) {
    case 'completed':
      return [styles.taskRow, styles.completedTaskRow]; // Grayed out
    case 'paused':
      return [styles.taskRow, styles.pausedTaskRow]; // Yellow background
    default:
      return styles.taskRow;
  }
};
```

### Button Rendering Logic

```typescript
const renderTaskButtons = (task: TaskStatus) => {
  switch (task.overall_status) {
    case 'completed':
      // Only show resume button for completed tasks
      return (
        <TouchableOpacity onPress={() => handleResume(task.task_log_id)}>
          <Text>Resume</Text>
        </TouchableOpacity>
      );
    
    case 'paused':
      // Show unpause and complete buttons
      return (
        <View>
          <TouchableOpacity onPress={() => handleUnpause(task.task_log_id)}>
            <Text>Resume from Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleComplete(task.task_log_id)}>
            <Text>Complete</Text>
          </TouchableOpacity>
        </View>
      );
    
    case 'in_progress':
    default:
      // Show pause and complete buttons
      return (
        <View>
          <TouchableOpacity onPress={() => handlePause(task.task_log_id)}>
            <Text>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleComplete(task.task_log_id)}>
            <Text>Complete</Text>
          </TouchableOpacity>
        </View>
      );
  }
};
```

## Error Handling

### Resume Conflicts
When attempting to resume a task with busy packers:

```typescript
const handleResume = async (taskLogId: string) => {
  const { data: canResumeData, error } = await db.canResumeTask(taskLogId);
  
  if (!canResumeData.can_resume) {
    Alert.alert(
      'Cannot Resume Task',
      canResumeData.message + '\\n\\nCreate new task with available packers?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Create New Task', 
          onPress: () => navigateToCreateTask(availablePackers)
        }
      ]
    );
    return;
  }
  
  // Proceed with resume...
};
```

## Testing

### Function Testing
```sql
-- Test resume check
SELECT can_resume_task('task-uuid-here');

-- Test task resume
SELECT resume_task('task-uuid-here');

-- Test task completion
SELECT complete_task('task-uuid-here');

-- View task status
SELECT * FROM task_status_view WHERE task_log_id = 'task-uuid-here';
```

### Component Testing
Use the `TaskManagementExample.tsx` component to test all functionality in your React Native app.

## Migration History

- `create_task_resume_function` - Added can_resume_task function
- `create_resume_task_function` - Added resume_task function  
- `create_complete_task_function` - Added complete_task function
- `create_pause_task_function` - Added pause_task function
- `create_unpause_task_function` - Added unpause_task function
- `create_task_status_view` - Added comprehensive task status view

## Next Steps

1. **Integrate UI Components**: Use the `TaskManagementExample.tsx` as a reference to implement in your main app
2. **Add Task Creation**: Implement task creation with the "Create New Task" flow for busy packer scenarios
3. **Real-time Updates**: Consider adding real-time subscriptions for task status changes
4. **Notifications**: Add push notifications for task assignments and status changes
5. **Analytics**: Track task completion times and packer productivity

## Security Considerations

- All functions check user permissions through RLS policies
- Task assignments are validated before state changes
- Audit trail maintained through update_counter increments
- No direct SQL injection vulnerabilities in client methods
