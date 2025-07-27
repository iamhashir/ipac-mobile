-- Quick check to see what users and profiles exist

-- 1. Check auth users
SELECT 
  id, 
  email, 
  created_at,
  email_confirmed_at
FROM auth.users 
ORDER BY created_at DESC;

-- 2. Check existing profiles
SELECT 
  p.id,
  p.full_name,
  p.username,
  r.name as role_name,
  p.status,
  p.packer_status
FROM public.profiles p
LEFT JOIN public.roles r ON p.role_id = r.id
ORDER BY p.created_at DESC;

-- 3. Check roles
SELECT * FROM public.roles ORDER BY name;
