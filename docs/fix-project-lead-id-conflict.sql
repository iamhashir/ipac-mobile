-- =====================================================
-- FIX DATABASE COLUMN CONFLICT
-- Drop the dependent view, run updates, and recreate it
-- =====================================================

-- 1. Drop the dependent view
DROP VIEW IF EXISTS available_orders_for_assignment;

-- 2. Run the existing updates
-- (You execute docs/database-updates-order-workflow.sql now)
-- This script contains ALTER TABLE commands

-- 3. Recreate the view without project_lead_id
-- Adjust the view logic as needed based on new structure
CREATE VIEW available_orders_for_assignment AS
SELECT 
    o.id,
    o.order_name,
    o.description,
    c.name as client_name,
    o.production_status,
    o.commercial_status,
    COALESCE(team_count.count, 0) as assigned_packers_count
FROM public.orders o
JOIN public.clients c ON o.client_id = c.id
LEFT JOIN (
    SELECT order_id, COUNT(*) as count
    FROM public.order_teams
    GROUP BY order_id
) team_count ON o.id = team_count.order_id
WHERE o.production_status IN ('pending', 'in_progress')
AND o.commercial_status = 'approved';

-- =====================================================
-- RUN THIS FIX, THEN RUN YOUR UPDATE SCRIPT
-- =====================================================

cool I ran them and no errors were returned, now did u check the excel sheet out? "2025-0603-V49-EDFUAE-BOILER` EQUIPMENT` GAS` PACKING-FARID-BN-R1.xlsm" and I also created populate-materials-db.md with actual data that I pulled from the excel sheet I have shown u here, and the users that I created in supabse earlier are:DIRECTOR USER:
DIRECTOR USER:Email: test@director.ipacPassword: director123Auto-confirm: YESADMIN USER:Email: test@admin.ipacPassword: admin123Auto-confirm: YESPACKER USERS:Email: test1@packer.ipacPassword: packer123Auto-confirm: YESEmail: test2@packer.ipac Password: packer123Auto-confirm: YESEmail: test3@packer.ipacPassword: packer123Auto-confirm: YES