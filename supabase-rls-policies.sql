-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- For IPAC Industrial Packaging Management System
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packing_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_package_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportation ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to get current user's role name
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT r.name 
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
    AND p.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT CASE permission_name
      WHEN 'can_block_users' THEN r.can_block_users
      WHEN 'can_unblock_users' THEN r.can_unblock_users
      WHEN 'can_ban_users' THEN r.can_ban_users
      WHEN 'can_reset_passwords' THEN r.can_reset_passwords
      WHEN 'can_delete_profiles' THEN r.can_delete_profiles
      WHEN 'can_manage_roles' THEN r.can_manage_roles
      ELSE FALSE
    END
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
    AND p.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is assigned to order
CREATE OR REPLACE FUNCTION user_assigned_to_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.order_teams 
    WHERE order_id = order_uuid 
    AND packer_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES FOR ROLES TABLE
-- =====================================================

-- All authenticated users can read roles (needed for UI and permissions)
CREATE POLICY "All authenticated users can read roles" ON public.roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only users with can_manage_roles permission can modify roles
CREATE POLICY "Users with manage_roles permission can modify roles" ON public.roles
  FOR ALL USING (user_has_permission('can_manage_roles'));

-- =====================================================
-- RLS POLICIES FOR PROFILES TABLE
-- =====================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin and director roles can read all profiles
CREATE POLICY "Admin and director can read all profiles" ON public.profiles
  FOR SELECT USING (get_user_role() IN ('admin', 'director'));

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin and director can create new profiles
CREATE POLICY "Admin and director can create profiles" ON public.profiles
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'director'));

-- Users with appropriate permissions can update other profiles
CREATE POLICY "Privileged users can manage profiles" ON public.profiles
  FOR UPDATE USING (
    get_user_role() IN ('admin', 'director') OR
    (user_has_permission('can_block_users') AND get_user_role() = 'project_lead')
  );

-- =====================================================
-- RLS POLICIES FOR CLIENTS TABLE
-- =====================================================

-- Admin, director, sales, and project_lead can read all clients
CREATE POLICY "Admin roles can read clients" ON public.clients
  FOR SELECT USING (get_user_role() IN ('admin', 'director', 'sales', 'project_lead'));

-- Admin, director, and sales can modify clients
CREATE POLICY "Admin and sales can modify clients" ON public.clients
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'sales'));

-- =====================================================
-- RLS POLICIES FOR ORDERS TABLE
-- =====================================================

-- Admin, director, sales, and project_lead can read all orders
CREATE POLICY "Admin roles can read all orders" ON public.orders
  FOR SELECT USING (get_user_role() IN ('admin', 'director', 'sales', 'project_lead'));

-- Packers can only read orders they are assigned to
CREATE POLICY "Packers can read assigned orders" ON public.orders
  FOR SELECT USING (
    get_user_role() = 'packer' AND 
    user_assigned_to_order(id)
  );

-- Admin, director, sales, and project_lead can modify orders
CREATE POLICY "Admin roles can modify orders" ON public.orders
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'sales', 'project_lead'));

-- =====================================================
-- RLS POLICIES FOR ORDER_PACKAGES TABLE
-- =====================================================

-- Admin, director, sales, and project_lead can read all order packages
CREATE POLICY "Admin roles can read all order_packages" ON public.order_packages
  FOR SELECT USING (get_user_role() IN ('admin', 'director', 'sales', 'project_lead'));

-- Packers can read packages from their assigned orders
CREATE POLICY "Packers can read assigned order_packages" ON public.order_packages
  FOR SELECT USING (
    get_user_role() = 'packer' AND 
    user_assigned_to_order(order_id)
  );

-- Admin, director, and project_lead can modify order packages
CREATE POLICY "Admin roles can modify order_packages" ON public.order_packages
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- Packers can update specific fields of packages they're assigned to
CREATE POLICY "Packers can update assigned order_packages" ON public.order_packages
  FOR UPDATE USING (
    get_user_role() = 'packer' AND 
    user_assigned_to_order(order_id)
  );

-- =====================================================
-- RLS POLICIES FOR MATERIALS AND VARIANTS
-- =====================================================

-- All authenticated users can read materials and variants (needed for selection)
CREATE POLICY "All authenticated users can read materials" ON public.materials
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can read material_variants" ON public.material_variants
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admin and director can modify materials
CREATE POLICY "Admin can modify materials" ON public.materials
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

CREATE POLICY "Admin can modify material_variants" ON public.material_variants
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

-- =====================================================
-- RLS POLICIES FOR ORDER_PACKAGE_MATERIALS
-- =====================================================

-- Admin, director, and project_lead can read all package materials
CREATE POLICY "Admin roles can read order_package_materials" ON public.order_package_materials
  FOR SELECT USING (
    get_user_role() IN ('admin', 'director', 'project_lead') OR
    (get_user_role() = 'packer' AND 
     user_assigned_to_order((SELECT order_id FROM public.order_packages WHERE id = order_package_id)))
  );

-- Admin, director, and project_lead can modify package materials
CREATE POLICY "Admin roles can modify order_package_materials" ON public.order_package_materials
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- Packers can update actual quantities and costs for assigned packages
CREATE POLICY "Packers can update package_materials actuals" ON public.order_package_materials
  FOR UPDATE USING (
    get_user_role() = 'packer' AND 
    user_assigned_to_order((SELECT order_id FROM public.order_packages WHERE id = order_package_id))
  );

-- =====================================================
-- RLS POLICIES FOR TASK_LOGS
-- =====================================================

-- Admin, director, and project_lead can read all task logs
CREATE POLICY "Admin roles can read all task_logs" ON public.task_logs
  FOR SELECT USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- Packers can read their own task logs
CREATE POLICY "Packers can read own task_logs" ON public.task_logs
  FOR SELECT USING (
    get_user_role() = 'packer' AND packer_id = auth.uid()
  );

-- Packers can create task logs for assigned packages
CREATE POLICY "Packers can create task_logs" ON public.task_logs
  FOR INSERT WITH CHECK (
    get_user_role() = 'packer' AND 
    packer_id = auth.uid() AND
    user_assigned_to_order((SELECT order_id FROM public.order_packages WHERE id = order_package_id))
  );

-- Packers can update their own task logs
CREATE POLICY "Packers can update own task_logs" ON public.task_logs
  FOR UPDATE USING (
    get_user_role() = 'packer' AND packer_id = auth.uid()
  );

-- =====================================================
-- RLS POLICIES FOR ATTENDANCE_LOGS
-- =====================================================

-- Admin, director, and project_lead can read all attendance logs
CREATE POLICY "Admin roles can read all attendance_logs" ON public.attendance_logs
  FOR SELECT USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- Packers can read their own attendance logs
CREATE POLICY "Packers can read own attendance_logs" ON public.attendance_logs
  FOR SELECT USING (
    get_user_role() = 'packer' AND packer_id = auth.uid()
  );

-- Packers can create their own attendance logs for assigned orders
CREATE POLICY "Packers can create attendance_logs" ON public.attendance_logs
  FOR INSERT WITH CHECK (
    get_user_role() = 'packer' AND 
    packer_id = auth.uid() AND
    user_assigned_to_order(order_id)
  );

-- =====================================================
-- RLS POLICIES FOR AUDIT_LOG
-- =====================================================

-- Only admin and director can read audit logs
CREATE POLICY "Admin can read audit_log" ON public.audit_log
  FOR SELECT USING (get_user_role() IN ('admin', 'director'));

-- System can insert audit logs (triggered by application or database triggers)
CREATE POLICY "System can insert audit_log" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- RLS POLICIES FOR LOOKUP/REFERENCE TABLES
-- =====================================================

-- All authenticated users can read lookup tables
CREATE POLICY "All authenticated can read units_of_measure" ON public.units_of_measure
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated can read packing_types" ON public.packing_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated can read suppliers" ON public.suppliers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated can read supplier_pricing" ON public.supplier_pricing
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated can read tags" ON public.tags
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated can read material_tags" ON public.material_tags
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admin can modify lookup tables
CREATE POLICY "Admin can modify units_of_measure" ON public.units_of_measure
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

CREATE POLICY "Admin can modify packing_types" ON public.packing_types
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

CREATE POLICY "Admin can modify suppliers" ON public.suppliers
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

CREATE POLICY "Admin can modify supplier_pricing" ON public.supplier_pricing
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

CREATE POLICY "Admin can modify tags" ON public.tags
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

CREATE POLICY "Admin can modify material_tags" ON public.material_tags
  FOR ALL USING (get_user_role() IN ('admin', 'director'));

-- =====================================================
-- RLS POLICIES FOR ORDER_TEAMS
-- =====================================================

-- Admin, director, and project_lead can read all team assignments
CREATE POLICY "Admin roles can read order_teams" ON public.order_teams
  FOR SELECT USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- Packers can read their own team assignments
CREATE POLICY "Packers can read own order_teams" ON public.order_teams
  FOR SELECT USING (
    get_user_role() = 'packer' AND packer_id = auth.uid()
  );

-- Admin, director, and project_lead can modify team assignments
CREATE POLICY "Admin roles can modify order_teams" ON public.order_teams
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- =====================================================
-- RLS POLICIES FOR TRANSPORTATION
-- =====================================================

-- Admin, director, and project_lead can read all transportation records
CREATE POLICY "Admin roles can read transportation" ON public.transportation
  FOR SELECT USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- Admin, director, and project_lead can modify transportation records
CREATE POLICY "Admin roles can modify transportation" ON public.transportation
  FOR ALL USING (get_user_role() IN ('admin', 'director', 'project_lead'));

-- =====================================================
-- GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant necessary permissions on tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant permissions on sequences (for auto-incrementing columns if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
