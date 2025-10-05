-- Fix Accessories Tag Issue
-- This script helps diagnose and fix the accessories dropdown issue in the packer portal

-- Step 1: Check if the 'accessories' tag exists
SELECT * FROM tags WHERE name = 'accessories';

-- If the tag doesn't exist, create it:
-- INSERT INTO tags (name) VALUES ('accessories')
-- ON CONFLICT (name) DO NOTHING
-- RETURNING *;

-- Step 2: Check which materials currently have the accessories tag
SELECT 
  m.id,
  m.name,
  m.description,
  t.name as tag_name
FROM materials m
JOIN material_tags mt ON m.id = mt.material_id
JOIN tags t ON mt.tag_id = t.id
WHERE t.name = 'accessories';

-- Step 3: Check all material variants (to see what's available)
SELECT 
  mv.id,
  mv.variant_name,
  m.name as material_name,
  m.unit_id,
  u.name as unit_name
FROM material_variants mv
JOIN materials m ON mv.material_id = m.id
LEFT JOIN units_of_measure u ON m.unit_id = u.id
ORDER BY m.name, mv.variant_name;

-- Step 4: To add the 'accessories' tag to a material, you can use:
-- First, make sure you have the tag ID and material ID
-- Example to tag a material with accessories:
-- 
-- INSERT INTO material_tags (material_id, tag_id)
-- SELECT 
--   '<MATERIAL_ID_HERE>'::uuid,
--   (SELECT id FROM tags WHERE name = 'accessories' LIMIT 1)
-- WHERE NOT EXISTS (
--   SELECT 1 FROM material_tags 
--   WHERE material_id = '<MATERIAL_ID_HERE>'::uuid 
--   AND tag_id = (SELECT id FROM tags WHERE name = 'accessories' LIMIT 1)
-- );

-- Step 5: Example - Tag multiple materials at once (customize the material names)
-- DO $$
-- DECLARE
--   accessories_tag_id uuid;
--   mat record;
-- BEGIN
--   -- Get or create accessories tag
--   INSERT INTO tags (name) 
--   VALUES ('accessories')
--   ON CONFLICT (name) DO UPDATE SET name = 'accessories'
--   RETURNING id INTO accessories_tag_id;
--   
--   -- Tag materials that should be accessories
--   -- Update this list with your actual material names
--   FOR mat IN 
--     SELECT id FROM materials 
--     WHERE name IN (
--       'Screws',
--       'Nails',
--       'Tape',
--       'Glue',
--       'Brackets',
--       'Hinges',
--       'Handles'
--       -- Add more material names here
--     )
--   LOOP
--     INSERT INTO material_tags (material_id, tag_id)
--     VALUES (mat.id, accessories_tag_id)
--     ON CONFLICT DO NOTHING;
--   END LOOP;
-- END $$;
