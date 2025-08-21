# Team Lead Implementation Guide

This guide explains how to implement the temporary team lead functionality in your IPAC Operations App.

## Overview

The team lead functionality allows regular packers to be assigned as temporary team leads for specific orders. This gives them elevated permissions (like marking attendance) only for the orders they lead, without needing a permanent role change.

## Database Changes

### 1. Apply the Migration

You need to execute the SQL migration file located at `supabase/migrations/20250121_add_team_lead_support.sql` in your Supabase database.

**Option A: Using Supabase Dashboard**
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of the migration file
4. Paste and execute the SQL

**Option B: Using Supabase CLI** (if you have it set up)
```bash
cd D:\IPAC-AUG
npx supabase db push
```

### 2. What the Migration Does

The migration adds the following:

1. **New Column**: `is_team_lead` boolean in `order_team_members` table
2. **New Functions**:
   - `is_team_lead_for_order(user_id, order_id)` - Checks if a user is team lead
   - `assign_team_lead(order_id, packer_id)` - Assigns team lead role
   - Updated `can_user_mark_attendance` - Now includes team lead checks
3. **Updated RLS Policies**: Attendance and session tables now allow team leads to manage their orders

## Frontend Implementation

### 1. Team Lead Selection (Already Implemented)

The packer dashboard (`app/(packer)/dashboard.tsx`) has been updated to:
- Allow selection of a team lead when creating a team
- Call the new `assignTeamLead` function when a team is created
- Display team lead status in the UI

### 2. New API Functions

A new file `utils/api/teamLead.ts` has been created with functions to:
- Assign team leads
- Check team lead status
- Get team lead for an order
- Remove team lead status
- Get all orders where a user is team lead

### 3. Attendance Permissions

The attendance screen already uses `can_user_mark_attendance` which now automatically includes team lead checks. No additional changes needed here.

## How It Works

1. **During Team Selection**: 
   - Packers select team members and designate one as team lead
   - The system calls `assign_team_lead` to set the `is_team_lead` flag

2. **Permission Checks**:
   - When marking attendance, the system checks if the user is:
     - Admin/Director (permanent role), OR
     - Team lead for that specific order (temporary role)

3. **Scope**: 
   - Team lead permissions are limited to the specific order
   - Once the order is completed, the team lead status is no longer relevant

## Testing the Implementation

1. **Test Team Assignment**:
   ```javascript
   // In browser console or test file
   const { data, error } = await teamLead.assignTeamLead(orderId, packerId);
   ```

2. **Test Permission Check**:
   ```javascript
   // Check if user can mark attendance
   const { data: canMark } = await db.canUserMarkAttendance(orderId);
   console.log('Can mark attendance:', canMark);
   ```

3. **Test Team Lead Status**:
   ```javascript
   // Check if user is team lead
   const { data: isLead } = await teamLead.isTeamLeadForOrder(userId, orderId);
   console.log('Is team lead:', isLead);
   ```

## Troubleshooting

### Common Issues

1. **404 Error on Functions**: Make sure the migration has been applied
2. **Permission Denied**: Check that RLS is enabled and policies are correct
3. **Team Lead Not Set**: Verify the `assign_team_lead` function was called

### Debugging SQL

To check team lead assignments:
```sql
SELECT * FROM order_team_members 
WHERE order_id = 'your-order-id' 
AND is_team_lead = TRUE;
```

To manually assign team lead (for testing):
```sql
UPDATE order_team_members 
SET is_team_lead = TRUE 
WHERE order_id = 'your-order-id' 
AND packer_id = 'your-packer-id';
```

## Next Steps

1. Apply the migration to your database
2. Test the team lead assignment flow
3. Verify attendance marking works for team leads
4. Monitor for any permission issues

## Additional Notes

- Team leads can only manage attendance for their assigned orders
- The system maintains an audit trail of who marked attendance
- Team lead status is preserved in the database for historical reference
- Multiple team leads per order are prevented by the `assign_team_lead` function
