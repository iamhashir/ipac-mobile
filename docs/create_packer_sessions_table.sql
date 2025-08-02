-- Create packer_sessions table for session management
CREATE TABLE packer_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  packer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  order_name TEXT,
  client_name TEXT,
  project_lead_name TEXT,
  team_selected BOOLEAN DEFAULT false,
  attendance_completed BOOLEAN DEFAULT false,
  packaging_started BOOLEAN DEFAULT false,
  session_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_packer_sessions_packer_active ON packer_sessions(packer_id, session_active);
CREATE INDEX idx_packer_sessions_created_at ON packer_sessions(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE packer_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Packers can only see their own sessions
CREATE POLICY "Packers can view own sessions" ON packer_sessions
  FOR SELECT USING (auth.uid() = packer_id);

-- Packers can create their own sessions
CREATE POLICY "Packers can create own sessions" ON packer_sessions
  FOR INSERT WITH CHECK (auth.uid() = packer_id);

-- Packers can update their own sessions
CREATE POLICY "Packers can update own sessions" ON packer_sessions
  FOR UPDATE USING (auth.uid() = packer_id);

-- Packers can delete their own sessions
CREATE POLICY "Packers can delete own sessions" ON packer_sessions
  FOR DELETE USING (auth.uid() = packer_id);
