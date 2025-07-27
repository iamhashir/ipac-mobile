-- =====================================================
-- TEST USERS SETUP SCRIPT
-- Run this in Supabase SQL Editor to create test users
-- =====================================================

-- First, let's insert the roles if they don't exist
INSERT INTO public.roles (name, can_block_users, can_unblock_users, can_ban_users, can_reset_passwords, can_delete_profiles, can_manage_roles) 
VALUES 
  ('director', true, true, true, true, true, true),
  ('admin', true, true, false, true, false, false),
  ('project_lead', true, true, false, false, false, false),
  ('sales', false, false, false, false, false, false),
  ('packer', false, false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;

-- Create test clients
INSERT INTO public.clients (name, contact_person, email, phone, address)
VALUES 
  ('ABC Manufacturing', 'John Smith', 'john@abcmfg.com', '+1-555-0101', '123 Industrial Ave'),
  ('XYZ Logistics', 'Jane Doe', 'jane@xyzlogistics.com', '+1-555-0102', '456 Shipping Blvd')
ON CONFLICT (name) DO NOTHING;

-- Create some test orders
INSERT INTO public.orders (client_id, order_name, description, commercial_status, production_status, created_by, project_lead_id)
SELECT 
  c.id, 
  'AIR LIQUIDE-B-10091', 
  'Industrial equipment packaging for air separation unit',
  'approved',
  'pending',
  NULL, -- We'll update this after creating users
  NULL   -- We'll update this after creating users
FROM public.clients c WHERE c.name = 'ABC Manufacturing'
ON CONFLICT DO NOTHING;

INSERT INTO public.orders (client_id, order_name, description, commercial_status, production_status, created_by, project_lead_id)
SELECT 
  c.id, 
  'MTU-Engine-981999',
  'MTU Engine packaging with vibration protection',
  'approved', 
  'pending',
  NULL,
  NULL
FROM public.clients c WHERE c.name = 'XYZ Logistics'
ON CONFLICT DO NOTHING;

-- Add units of measure
INSERT INTO public.units_of_measure (name, description)
VALUES 
  ('Pce', 'Pieces'),
  ('m2', 'Square meters'),
  ('kg', 'Kilograms'),
  ('m', 'Meters'),
  ('hour', 'Hours'),
  ('trip', 'Trips')
ON CONFLICT (name) DO NOTHING;

-- Add packing types
INSERT INTO public.packing_types (code, name, description, includes_contact, includes_waterproofing)
VALUES 
  ('4A', 'Contact Wood', 'Standard wood contact packaging', true, false),
  ('4B', 'Waterproofing', 'Waterproof packaging with barrier protection', true, true),
  ('4C', 'Gas Protection', 'Gas barrier protection packaging', true, true),
  ('1A', 'Vibration Protection', 'Anti-vibration packaging system', true, false)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- MANUAL USER CREATION INSTRUCTIONS
-- =====================================================

-- Since we can't create auth.users directly via SQL, you need to:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" and create these users:

/*
DIRECTOR USER:
- Email: director@ipac.com
- Password: director123
- Auto-confirm: YES

ADMIN USER:
- Email: admin@ipac.com  
- Password: admin123
- Auto-confirm: YES

PROJECT LEAD USER:
- Email: lead@ipac.com
- Password: lead123
- Auto-confirm: YES

PACKER USERS:
- Email: packer1@ipac.com
- Password: packer123
- Auto-confirm: YES

- Email: packer2@ipac.com  
- Password: packer123
- Auto-confirm: YES

- Email: packer3@ipac.com
- Password: packer123
- Auto-confirm: YES
*/

-- After creating the users in the dashboard, run this SQL to create their profiles:
-- (Replace the UUIDs with the actual user IDs from the auth.users table)

-- You can find the user IDs by running: SELECT id, email FROM auth.users;

-- Then insert profiles like this (REPLACE THE IDs WITH ACTUAL USER IDs):
/*
INSERT INTO public.profiles (id, full_name, username, role_id, status, packer_status)
SELECT 
  'USER_ID_FROM_AUTH_USERS', -- Replace with actual UUID
  'Director Name',
  'director',
  r.id,
  'active',
  NULL
FROM public.roles r WHERE r.name = 'director';
*/

-- This is a bit manual, but once we get the Edge Functions deployed, 
-- we can create users programmatically!
