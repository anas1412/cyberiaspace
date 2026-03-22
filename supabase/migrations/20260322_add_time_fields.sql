-- Add new time-based columns to the thoughts table
ALTER TABLE thoughts ADD COLUMN start_time timestamptz;
ALTER TABLE thoughts ADD COLUMN end_time timestamptz;
ALTER TABLE thoughts ADD COLUMN is_all_day boolean DEFAULT false;
ALTER TABLE thoughts ADD COLUMN reminders jsonb DEFAULT '[]';
ALTER TABLE thoughts ADD COLUMN recurrence_rule text;
ALTER TABLE thoughts ADD COLUMN location text;

-- Add indexes for better query performance
CREATE INDEX idx_thoughts_start_time ON thoughts (start_time);
CREATE INDEX idx_thoughts_end_time ON thoughts (end_time);

-- Backfill data from 'date' column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thoughts' AND column_name = 'date') THEN
        UPDATE thoughts 
        SET 
            start_time = date::timestamptz,
            end_time = date::timestamptz,
            is_all_day = true
        WHERE date IS NOT NULL AND date <> '';
        
        -- Drop the old column
        ALTER TABLE thoughts DROP COLUMN date;
    END IF;
END $$;
