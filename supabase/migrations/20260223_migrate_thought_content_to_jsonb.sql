-- Migration: Populate content JSONB field from old columns
-- This migration maps the old flat columns to the new unified content JSONB field

-- Add content column if not exists (for fresh installs)
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}';

-- Populate content field based on thought type
UPDATE thoughts
SET content = (
    CASE
        WHEN type = 'text' THEN
            jsonb_build_object('text', COALESCE(content::text, ''))
        WHEN type = 'tasks' THEN
            jsonb_build_object('tasks', COALESCE(tasks, '[]'::jsonb))
        WHEN type = 'table' THEN
            jsonb_build_object('table', COALESCE("table", '[]'::jsonb))
        WHEN type = 'paint' THEN
            jsonb_build_object('drawing', COALESCE(drawing, ''))
        WHEN type = 'image' THEN
            jsonb_build_object('image', COALESCE(image, ''))
        WHEN type = 'embed' THEN
            jsonb_build_object('embed', COALESCE(content::text, ''))
        WHEN type = 'file' THEN
            jsonb_build_object(
                'file', COALESCE(content::text, ''),
                'name', COALESCE(meta->>'fileName', text, ''),
                'size', COALESCE((meta->>'fileSize')::int, 0)
            )
        WHEN type = 'label' THEN
            NULL
        ELSE '{}'::jsonb
    END
)
WHERE content::text = '{}' OR content IS NULL OR content::text = '';

-- Verify
SELECT type, count(*) as count FROM thoughts GROUP BY type;
