-- Script to identify and fix problematic unit names that could cause React Native text node errors
-- This addresses the "Unexpected text node: . A text node cannot be a child of a <View>" error

-- First, let's identify any problematic unit names
SELECT id, name, description 
FROM units_of_measure 
WHERE name IS NULL 
   OR TRIM(name) = '' 
   OR TRIM(name) = '.' 
   OR LENGTH(TRIM(name)) = 0;

-- Update any null, empty, or single period unit names to a default value
UPDATE units_of_measure 
SET name = 'unit' 
WHERE name IS NULL 
   OR TRIM(name) = '' 
   OR TRIM(name) = '.' 
   OR LENGTH(TRIM(name)) = 0;

-- Also check for any variant unit names that might have the same issue
SELECT mv.id, mv.variant_name, mv.unit_id, u.name as unit_name
FROM material_variants mv
LEFT JOIN units_of_measure u ON mv.unit_id = u.id
WHERE u.name IS NULL 
   OR TRIM(u.name) = '' 
   OR TRIM(u.name) = '.' 
   OR LENGTH(TRIM(u.name)) = 0;

-- Show the results after cleanup
SELECT id, name, description 
FROM units_of_measure 
ORDER BY name;