# Packer Management System Improvements

## Overview
This document summarizes the enhancements made to the packer management system to support multiple team leads, packer self-removal, and improved admin controls.

## Changes Implemented

### 1. Multiple Team Leads Support ✅

**Database Changes:**
- **Migration:** `20250126_multiple_team_leads.sql`
- Added support for multiple team leads per order
- New functions:
  - `add_team_lead(order_uuid, packer_uuid)` - Adds a lead without removing existing leads
  - `remove_team_lead(order_uuid, packer_uuid)` - Removes a specific lead
  - `get_order_team_leads(order_uuid)` - Returns all leads for an order
  - `order_has_team_lead(order_uuid)` - Checks if order has at least one lead
  - `count_order_team_leads(order_uuid)` - Returns count of leads
- Backward compatible: `assign_team_lead()` still works for single-lead assignment

**API Changes:**
- Updated `utils/api/teamLead.ts`:
  - Added `addTeamLead()` - Add lead (multi-lead support)
  - Updated `removeTeamLead()` - Remove specific lead
  - Added `removeAllTeamLeads()` - Clear all leads
  - Added `getOrderTeamLeads()` - Get all leads
  - Added `orderHasTeamLead()` - Check for leads
  - Added `countOrderTeamLeads()` - Count leads

**UI Changes:**
- **Packer Dashboard** (`app/(packer)/dashboard.tsx`):
  - Changed from single `projectLead` to `projectLeads` array
  - Users can now select multiple team leads via checkboxes
  - Lead checkboxes now properly show checked state
  - All selected leads are assigned when creating order sessions
  
- **Admin Assignment Board** (`components/admin/users/`):
  - `AssignmentsBoard.tsx` - Fetches and manages multiple leads per order
  - `OrderLane.tsx` - Displays multiple team leads, supports add/remove
  - `PackerCard.tsx` - Shows "Team Lead ✕" button to remove lead status

### 2. Packer Self-Removal ✅

**Database Changes:**
- **Migration:** `20250126_packer_self_removal.sql`
- New function: `remove_self_from_order(order_uuid, packer_uuid)`
- Validates:
  - Packer is assigned to the order
  - Not the last packer (prevents order abandonment)
  - If last lead, prevents removal (requires assigning another lead first)
- Automatically ends active sessions on removal

**API Changes:**
- Added `db.removeSelfFromOrder(orderId, packerId)` in `utils/api/supabase.ts`

**UI Component:**
- **New Component:** `components/packing/RemoveSelfButton.tsx`
  - Reusable button for packer self-removal
  - Checks eligibility before removal
  - If last lead, shows UI to assign new lead first
  - Prevents last packer from leaving
  - Shows appropriate error messages
  - Can be integrated into any packer screen

**Usage Example:**
```tsx
import RemoveSelfButton from '../../components/packing/RemoveSelfButton';

<RemoveSelfButton 
  orderId={orderId}
  orderName={orderName}
  onSuccess={() => router.push('/dashboard')}
/>
```

### 3. Order Lock Bug Fix ✅

**Problem:** When admin removes the last packer from an order, the order becomes locked and no one can join it.

**Solution:**
- **Migration:** `20250126_fix_order_lock_on_empty.sql`
- New trigger: `trigger_handle_empty_order` on `order_team_members` table
- When last packer is removed:
  - Resets `production_status` to 'pending'
  - Clears `project_lead_id`
  - Order becomes available for new assignments

### 4. Lead Checkbox Display Fix ✅

**Problem:** In the packer dashboard, leads were highlighted but the lead checkbox wasn't showing as checked.

**Solution:**
- Updated `app/(packer)/dashboard.tsx`:
  - Changed `isProjectLead` check from `projectLead === packer.id` to `projectLeads.includes(packer.id)`
  - Checkbox now properly reflects lead status
  - Works with multiple leads

## Features Summary

### For Packers:
✅ Select multiple team leads when starting an order
✅ See correct checkbox state for team leads
✅ Remove themselves from orders (with validations)
✅ Must assign new lead if they're the last lead before leaving
✅ Cannot leave if they're the last packer

### For Admins:
✅ Assign multiple team leads to orders
✅ Remove individual leads (click "Team Lead ✕" button)
✅ Drag and drop packers between orders
✅ Orders automatically unlock when last packer removed
✅ View all leads for each order

### For Team Leads:
✅ Can still add other packers to their order from dashboard
✅ Multiple leads can manage the same order
✅ System prevents orders from having no leads

## Database Functions Reference

### Team Lead Functions
```sql
-- Add a lead (keeps existing leads)
SELECT add_team_lead('order-uuid', 'packer-uuid');

-- Remove a specific lead
SELECT remove_team_lead('order-uuid', 'packer-uuid');

-- Get all leads for an order
SELECT * FROM get_order_team_leads('order-uuid');

-- Check if order has any lead
SELECT order_has_team_lead('order-uuid');

-- Count leads
SELECT count_order_team_leads('order-uuid');
```

### Packer Removal Function
```sql
-- Remove self from order (returns JSON with success/error)
SELECT remove_self_from_order('order-uuid', 'packer-uuid');
```

## Migration Files Created

1. `20250126_multiple_team_leads.sql` - Multi-lead support
2. `20250126_fix_order_lock_on_empty.sql` - Auto-unlock empty orders
3. `20250126_packer_self_removal.sql` - Self-removal with validations

## Files Modified

### API Layer
- `utils/api/teamLead.ts` - Added multi-lead functions
- `utils/api/supabase.ts` - Added `removeSelfFromOrder()`

### UI Components
- `app/(packer)/dashboard.tsx` - Multi-lead selection, checkbox fix
- `components/admin/users/AssignmentsBoard.tsx` - Multi-lead management
- `components/admin/users/OrderLane.tsx` - Multi-lead display, toggle
- `components/admin/users/PackerCard.tsx` - Lead remove button

### New Files
- `components/packing/RemoveSelfButton.tsx` - Self-removal UI component

## Testing Checklist

### Multiple Leads
- [ ] Select multiple packers as leads in dashboard
- [ ] Verify all selected leads are assigned
- [ ] Admin can add/remove leads via PackerCard buttons
- [ ] Lead checkboxes show correct checked state

### Self-Removal
- [ ] Packer can remove themselves when not last packer
- [ ] Last packer cannot remove themselves
- [ ] Last lead must assign new lead before leaving
- [ ] Session is ended when packer leaves

### Order Lock Fix
- [ ] Remove all packers from an order (as admin)
- [ ] Verify order status changes to 'pending'
- [ ] Verify order is available for new assignments
- [ ] Verify project_lead_id is cleared

## Backward Compatibility

All changes are backward compatible:
- Single-lead assignment still works via `assign_team_lead()`
- Existing code using `teamLeadId` still functions
- New code can use `teamLeadIds` array for multi-lead support
- Database triggers handle edge cases automatically

## Notes

- The system prevents orders from having zero team leads (at least one required)
- The system prevents orders from having zero packers (requires admin intervention)
- All database functions use `SECURITY DEFINER` for proper permission handling
- Session cleanup is automatic when packers leave orders
