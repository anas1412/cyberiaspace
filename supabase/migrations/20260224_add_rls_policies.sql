-- RLS Policies for Cyberia Tables

-- Enable RLS
ALTER TABLE published_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Published Spaces: Anyone can read, only owner can modify
CREATE POLICY "Published spaces are viewable by anyone" 
ON published_spaces FOR SELECT USING (true);

CREATE POLICY "Users can insert their own published spaces"
ON published_spaces FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete their own published spaces" 
ON published_spaces FOR DELETE USING (auth.uid() = user_id::uuid);

-- Feedback: Anyone can create, only owner can read their own, admin can read all
CREATE POLICY "Anyone can submit feedback"
ON feedback FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own feedback"
ON feedback FOR SELECT USING (auth.uid() = user_id::uuid);

-- Note: For admin access, use the admin function with x-admin-key header
-- rather than direct table access
