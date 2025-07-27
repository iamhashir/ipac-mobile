-- =====================================================
-- CREATE PROFILES FOR TEST USERS
-- Run this after creating the users in Supabase Auth Dashboard
-- Replace the UUIDs with actual user IDs from auth.users
-- =====================================================

-- First, check existing users
SELECT id, email FROM auth.users;

-- Then run this with the actual UUIDs (replace 'REPLACE_WITH_ACTUAL_UUID')

-- Director Profile
INSERT INTO public.profiles (id, full_name, username, role_id, status, packer_status)
SELECT 
  'REPLACE_WITH_DIRECTOR_UUID', -- Replace with actual UUID from auth.users
  'IPAC Director',
  'director',
  r.id,
  'active',
  NULL
FROM public.roles r WHERE r.name = 'director';

-- Admin Profile
INSERT INTO public.profiles (id, full_name, username, role_id, status, packer_status)
SELECT 
  'REPLACE_WITH_ADMIN_UUID', -- Replace with actual UUID from auth.users
  'IPAC Admin',
  'admin',
  r.id,
  'active',
  NULL
FROM public.roles r WHERE r.name = 'admin';

-- Packer 1 Profile
INSERT INTO public.profiles (id, full_name, username, role_id, status, packer_status)
SELECT 
  'REPLACE_WITH_PACKER1_UUID', -- Replace with actual UUID from auth.users
  'Mohammed Ijaz',
  'mohammed_ijaz',
  r.id,
  'active',
  'available'
FROM public.roles r WHERE r.name = 'packer';

-- Packer 2 Profile
INSERT INTO public.profiles (id, full_name, username, role_id, status, packer_status)
SELECT 
  'REPLACE_WITH_PACKER2_UUID', -- Replace with actual UUID from auth.users
  'Mushtaq Ahmad',
  'mushtaq_ahmad',
  r.id,
  'active',
  'available'
FROM public.roles r WHERE r.name = 'packer';

-- Packer 3 Profile
INSERT INTO public.profiles (id, full_name, username, role_id, status, packer_status)
SELECT 
  'REPLACE_WITH_PACKER3_UUID', -- Replace with actual UUID from auth.users
  'Fazal Khurem Khan',
  'fazal_khurem',
  r.id,
  'active',
  'available'
FROM public.roles r WHERE r.name = 'packer';

-- Verify the profiles were created
SELECT 
  p.id,
  p.full_name,
  p.username,
  r.name as role_name,
  p.status,
  p.packer_status
FROM public.profiles p
JOIN public.roles r ON p.role_id = r.id
ORDER BY r.name, p.full_name;
