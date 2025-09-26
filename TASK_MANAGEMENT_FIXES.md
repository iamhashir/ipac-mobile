# Task Management Bug Fixes

## Date: January 22, 2025

### Issues Fixed

#### 1. **Task Assignment Filtering Issue**
**Problem**: Task assignment sections in individual package tabs were displaying ALL tasks from the entire order instead of only tasks related to the specific package.

**Root Cause**: The `OrderTasksManagement` component was using `getTaskLogsByOrderPackageIds()` for both:
- Overview tab (correctly showing all tasks for all packages)  
- Individual package tabs (incorrectly showing all tasks instead of package-specific tasks)

**Solution**: 
- Added new `getTaskLogsForPackage(orderPackageId)` API function for single-package queries
- Modified `OrderTasksManagement.refreshLogs()` to detect single vs multi-package mode:
  - Single package mode (len=1): Uses `getTaskLogsForPackage()` for precise filtering
  - Multi package mode (len>1): Uses `getTaskLogsByOrderPackageIds()` for overview

**Files Changed**:
- `utils/api/supabase.ts`: Added `getTaskLogsForPackage()` function
- `components/packing/order_tasks_management.tsx`: Modified `refreshLogs()` logic

#### 2. **Available/Busy Count Reset to Zero**
**Problem**: The available and busy packer counts would intermittently reset to 0 during polling, even when packers were actually working.

**Root Cause**: Multiple issues:
- `getBusyPackerIds()` could return `null` on error instead of empty array
- Stale closures in `setInterval` callbacks accessing outdated `teamPackers` state
- Race conditions with component unmounting during async operations

**Solution**:
- **Defensive Error Handling**: Modified `getBusyPackerIds()` to always return arrays, never `null`
- **Fixed Stale Closures**: Added `teamPackersRef` and `isMountedRef` to prevent stale state access
- **Robust Error Recovery**: Don't update counts on API errors to prevent false resets
- **Mount Safety**: Check `isMountedRef.current` before state updates

**Files Changed**:
- `utils/api/supabase.ts`: Hardened `getBusyPackerIds()` error handling
- `components/packing/order_tasks_management.tsx`: Added refs, improved polling safety

#### 3. **Backend Query Optimization (Bonus)**
**Enhancement**: Improved `getTaskLogsByOrderPackageIds()` to use inner join instead of two-step fetch for better data consistency.

**Before**: Two separate queries (task_packages → task_logs)
**After**: Single query with `task_packages!inner(order_package_id)` join

### Technical Details

#### Database Schema Relationships
```
task_logs ←→ task_packages ←→ order_packages
         ↘                ↗
           task_assignments
```

#### API Functions Added/Modified
1. **New**: `getTaskLogsForPackage(orderPackageId: string)` - Get tasks for single package
2. **Enhanced**: `getBusyPackerIds()` - Better error handling, always returns array
3. **Optimized**: `getTaskLogsByOrderPackageIds()` - Uses inner join for accuracy

#### Component Changes
1. **OrderTasksManagement**: 
   - Smart query selection based on package count
   - Added `useRef` for stale closure prevention
   - Improved polling robustness
2. **TaskLogsTable**: 
   - Added optional filtering props (prepared for future use)

### Testing Recommendations

#### Manual Testing
1. **Task Filtering**: 
   - Create order with 2+ packages
   - Create tasks linked to different packages via `task_packages` table
   - Verify overview shows all tasks, individual package tabs show only their tasks

2. **Busy Count Stability**:
   - Start task, verify busy count updates
   - Wait 30+ seconds with polling active
   - Verify counts remain accurate, never drop to 0

3. **Real-time Updates**:
   - Disable websocket in dev tools
   - Start/stop tasks
   - Verify polling keeps counts correct

#### Unit Test Additions Needed
- `getBusyPackerIds()` error scenarios
- `refreshBusyStatus()` with mocked responses  
- `TaskLogsTable` filtering logic
- `OrderTasksManagement` single vs multi-package mode

### Migration Notes
- **Backward Compatible**: No database schema changes required
- **API Compatible**: Existing `getTaskLogsByOrderPackageIds()` behavior unchanged
- **New Functions**: `getTaskLogsForPackage()` available for other components

### Performance Impact
- **Positive**: Single-package queries are now faster (1 query vs 2)
- **Neutral**: Multi-package queries same performance with better accuracy
- **Reduced**: Less unnecessary re-renders due to stale closure fixes

---

**Validated By**: [Your Name]  
**Code Review**: Pending  
**QA Testing**: Pending  
**Production Deploy**: Pending