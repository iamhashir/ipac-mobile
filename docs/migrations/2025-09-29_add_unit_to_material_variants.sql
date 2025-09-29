-- Migration: Add unit_id to material_variants to reference units_of_measure
-- Date: 2025-09-29
-- Note: Apply in Supabase/DB before deploying UI depending on this column.

BEGIN;

ALTER TABLE public.material_variants
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units_of_measure(id);

COMMIT;
