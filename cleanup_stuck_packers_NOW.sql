-- ============================================
-- COMPLETE CLEANUP FOR STUCK PACKERS
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- Step 1: Clear ALL packers who are marked as 'working' but have NO assignment
UPDATE profiles
SET 
    packer_status = 'available',
    current_order_id = NULL
WHERE packer_status = 'working'
AND id NOT IN (
    SELECT DISTINCT packer_id 
    FROM order_team_members
);

-- Step 2: End ALL orphaned packer sessions
UPDATE packer_sessions
SET 
    session_active = false,
    updated_at = NOW()
WHERE session_active = true
AND NOT EXISTS (
    SELECT 1 
    FROM order_team_members otm
    WHERE otm.packer_id = packer_sessions.packer_id
    AND otm.order_id = packer_sessions.order_id
);

-- Step 3: Fix any packer with current_order_id set but not in order_team_members
UPDATE profiles
SET 
    current_order_id = NULL,
    packer_status = 'available'
WHERE current_order_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 
    FROM order_team_members otm
    WHERE otm.packer_id = profiles.id
);

-- Step 4: Verify - This should return EMPTY if everything is clean
SELECT 
    p.id,
    p.full_name,
    p.packer_status,
    p.current_order_id,
    COUNT(otm.id) as assignments,
    COUNT(ps.id) FILTER (WHERE ps.session_active = true) as active_sessions
FROM profiles p
LEFT JOIN order_team_members otm ON p.id = otm.packer_id
LEFT JOIN packer_sessions ps ON p.id = ps.packer_id
WHERE p.packer_status = 'working'
GROUP BY p.id, p.full_name, p.packer_status, p.current_order_id
HAVING COUNT(otm.id) = 0;

-- If the above query returns any rows, there's still stuck packers
-- Run this script again or manually fix those specific IDs
