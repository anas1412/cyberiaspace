-- Remove spatial coordinates and physics velocity from cloud storage
-- These properties are now local-only to reduce egress and database overhead.

ALTER TABLE thoughts 
DROP COLUMN IF EXISTS x,
DROP COLUMN IF EXISTS y,
DROP COLUMN IF EXISTS vx,
DROP COLUMN IF EXISTS vy;

COMMENT ON TABLE thoughts IS 'Spatial coordinates (x, y) and physics velocity (vx, vy) are now handled locally in the browser (Dexie) to reduce cloud egress.';
