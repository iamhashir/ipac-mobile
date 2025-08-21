-- =====================================================
-- CHECK AND CREATE order_team_members TABLE
-- Run this first to ensure the table exists
-- =====================================================

-- Check if table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_team_members') THEN
        RAISE NOTICE 'Creating order_team_members table...';
    ELSE
        RAISE NOTICE 'Table order_team_members already exists.';
    END IF;
END $$;

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.order_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    packer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure no duplicate assignments
    UNIQUE(order_id, packer_id)
);

-- Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_team_members_order_id ON public.order_team_members(order_id);
CREATE INDEX IF NOT EXISTS idx_order_team_members_packer_id ON public.order_team_members(packer_id);
CREATE INDEX IF NOT EXISTS idx_order_team_members_created_at ON public.order_team_members(created_at);

-- Add comments for clarity
COMMENT ON TABLE public.order_team_members IS 'Junction table linking orders to assigned packers. Uses proper relational design for better performance and querying.';
COMMENT ON COLUMN public.order_team_members.order_id IS 'References the order this packer is assigned to';
COMMENT ON COLUMN public.order_team_members.packer_id IS 'References the packer assigned to this order';
COMMENT ON COLUMN public.order_team_members.created_at IS 'When this packer was assigned to the order';

-- Enable RLS
ALTER TABLE public.order_team_members ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY IF NOT EXISTS "Admin roles can manage order_team_members" ON public.order_team_members
    FOR ALL USING (get_user_role() IN ('admin', 'director', 'project_lead'));

CREATE POLICY IF NOT EXISTS "Packers can read own team assignments" ON public.order_team_members
    FOR SELECT USING (
        get_user_role() = 'packer' AND packer_id = auth.uid()
    );

-- Success message
SELECT 'order_team_members table setup completed!' as status;
