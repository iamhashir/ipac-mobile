-- ============================================
-- EMERGENCY CLEANUP - RUN THIS RIGHT NOW
-- Copy and paste into Supabase SQL Editor
-- ============================================

-- Fix ALL stuck packers in one go
UPDATE profiles
SET 
    packer_status = 'available',
    current_order_id = NULL
WHERE id IN (
    -- Find packers who claim to be working but aren't in order_team_members
    SELECT p.id
    FROM profiles p
    WHERE p.packer_status = 'working'
    AND NOT EXISTS (
        SELECT 1 
        FROM order_team_members otm
        WHERE otm.packer_id = p.id
    )
);

-- End all orphaned sessions
UPDATE packer_sessions
SET session_active = false
WHERE session_active = true
AND NOT EXISTS (
    SELECT 1 
    FROM order_team_members otm
    WHERE otm.packer_id = packer_sessions.packer_id
    AND otm.order_id = packer_sessions.order_id
);

-- Check if it worked - should return 0 rows
SELECT 
    id,
    full_name,
    packer_status,
    current_order_id
FROM profiles
WHERE packer_status = 'working'
AND id NOT IN (SELECT DISTINCT packer_id FROM order_team_members);
