-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  category text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.attendance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  packer_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  shift_period text NOT NULL CHECK (shift_period = ANY (ARRAY['morning'::text, 'afternoon'::text, 'full_day'::text])),
  status text NOT NULL DEFAULT 'present'::text CHECK (status = ANY (ARRAY['present'::text, 'absent'::text])),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  toolbox_briefing_completed boolean DEFAULT false,
  is_project_start boolean DEFAULT false,
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT attendance_logs_packer_id_fkey FOREIGN KEY (packer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  column_name text,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  change_time timestamp with time zone DEFAULT now(),
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text, 'ALERT'::text, 'PASSWORD_RESET'::text, 'BLOCK_USER'::text, 'UNBLOCK_USER'::text, 'BAN_USER'::text, 'ROLE_CHANGE'::text, 'PROFILE_DELETE'::text])),
  is_critical_alert boolean DEFAULT false,
  notes text,
  order_id uuid,
  order_package_id uuid,
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id),
  CONSTRAINT audit_log_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT audit_log_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id)
);
CREATE TABLE public.beam (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quantity numeric,
  type uuid,
  width numeric,
  thickness numeric,
  space numeric,
  CONSTRAINT beam_pkey PRIMARY KEY (id),
  CONSTRAINT beam_type_fkey FOREIGN KEY (type) REFERENCES public.material_variants(id)
);
CREATE TABLE public.box_type (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT box_type_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact_person text,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.material_tags (
  material_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT material_tags_pkey PRIMARY KEY (material_id, tag_id),
  CONSTRAINT material_tags_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT material_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.material_variant_tags (
  material_variant_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT material_variant_tags_pkey PRIMARY KEY (material_variant_id, tag_id),
  CONSTRAINT material_variant_tags_material_variant_id_fkey FOREIGN KEY (material_variant_id) REFERENCES public.material_variants(id),
  CONSTRAINT material_variant_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.material_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  variant_name text NOT NULL,
  attributes jsonb,
  created_at timestamp with time zone DEFAULT now(),
  description text,
  unit_id uuid,
  length numeric,
  width numeric,
  thickness numeric,
  weight_per_unit numeric,
  pending_approval boolean DEFAULT false,
  approval_status text DEFAULT 'approved'::text CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  requested_by uuid,
  requested_at timestamp with time zone,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  admin_notes text,
  order_package_context uuid,
  CONSTRAINT material_variants_pkey PRIMARY KEY (id),
  CONSTRAINT material_variants_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units_of_measure(id),
  CONSTRAINT material_variants_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT material_variants_order_package_context_fkey FOREIGN KEY (order_package_context) REFERENCES public.order_packages(id),
  CONSTRAINT material_variants_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  CONSTRAINT material_variants_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  unit_id uuid,
  pending_approval boolean DEFAULT false,
  approval_status text DEFAULT 'approved'::text CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  requested_by uuid,
  requested_at timestamp with time zone,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  admin_notes text,
  order_package_context uuid,
  CONSTRAINT materials_pkey PRIMARY KEY (id),
  CONSTRAINT materials_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units_of_measure(id),
  CONSTRAINT materials_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  CONSTRAINT materials_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id),
  CONSTRAINT materials_order_package_context_fkey FOREIGN KEY (order_package_context) REFERENCES public.order_packages(id)
);
CREATE TABLE public.media (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  image_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  order_package_id uuid NOT NULL,
  designation USER-DEFINED,
  CONSTRAINT media_pkey PRIMARY KEY (id),
  CONSTRAINT media_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id)
);
CREATE TABLE public.order_package_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_package_id uuid NOT NULL,
  material_variant_id uuid NOT NULL,
  material_type USER-DEFINED NOT NULL,
  is_final boolean NOT NULL DEFAULT false,
  quantity numeric NOT NULL CHECK (quantity >= 0::numeric),
  unit_id uuid NOT NULL,
  length numeric,
  width numeric,
  height numeric,
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  item_used boolean NOT NULL DEFAULT false,
  original uuid,
  quantity_used numeric,
  CONSTRAINT order_package_materials_pkey PRIMARY KEY (id),
  CONSTRAINT order_package_materials_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id),
  CONSTRAINT order_package_materials_material_variant_id_fkey FOREIGN KEY (material_variant_id) REFERENCES public.material_variants(id),
  CONSTRAINT order_package_materials_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units_of_measure(id),
  CONSTRAINT order_package_materials_original_fkey FOREIGN KEY (original) REFERENCES public.order_package_materials(id)
);
CREATE TABLE public.order_package_securing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_package_id uuid NOT NULL,
  securing_template_id uuid NOT NULL,
  securing_side USER-DEFINED NOT NULL,
  is_final boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_package_securing_pkey PRIMARY KEY (id),
  CONSTRAINT order_package_securing_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id),
  CONSTRAINT order_package_securing_securing_template_id_fkey FOREIGN KEY (securing_template_id) REFERENCES public.securing_template(id)
);
CREATE TABLE public.order_package_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_package_id uuid NOT NULL,
  service_id uuid NOT NULL,
  is_final boolean NOT NULL DEFAULT false,
  result jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_package_services_pkey PRIMARY KEY (id),
  CONSTRAINT order_package_services_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id),
  CONSTRAINT order_package_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id)
);
CREATE TABLE public.order_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  package_number integer NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'design'::text CHECK (status = ANY (ARRAY['design'::text, 'approved'::text, 'in_production'::text, 'packed'::text, 'delivered'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  original_pkg_info uuid,
  final_pkg_info uuid,
  comments jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT order_packages_pkey PRIMARY KEY (id),
  CONSTRAINT order_packages_original_pkg_info_fkey FOREIGN KEY (original_pkg_info) REFERENCES public.package_info(id),
  CONSTRAINT order_packages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_packages_final_pkg_info_fkey FOREIGN KEY (final_pkg_info) REFERENCES public.package_info(id)
);
CREATE TABLE public.order_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  packer_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  is_team_lead boolean DEFAULT false,
  CONSTRAINT order_team_members_pkey PRIMARY KEY (id),
  CONSTRAINT order_team_members_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_team_members_packer_id_fkey FOREIGN KEY (packer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  order_name text NOT NULL,
  description text,
  commercial_status text NOT NULL DEFAULT 'draft'::text CHECK (commercial_status = ANY (ARRAY['draft'::text, 'quoted'::text, 'approved'::text, 'invoiced'::text, 'paid'::text])),
  created_by uuid,
  total_estimated_cost numeric,
  total_actual_cost numeric,
  production_status text NOT NULL DEFAULT 'pending'::text CHECK (production_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'on_hold'::text])),
  start_date timestamp with time zone,
  completion_date timestamp with time zone,
  total_transportation_cost numeric DEFAULT 0.0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  project_lead_id uuid,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT orders_project_lead_id_fkey FOREIGN KEY (project_lead_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.package_info (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  internal_length numeric,
  internal_width numeric,
  internal_height numeric,
  external_length numeric,
  external_width numeric,
  external_height numeric,
  center_of_gravity boolean,
  quantity integer,
  packing_type_id uuid,
  tare numeric,
  net_weight numeric,
  gross_weight numeric,
  boxes_completed integer NOT NULL DEFAULT 0,
  box_type_id uuid,
  CONSTRAINT package_info_pkey PRIMARY KEY (id),
  CONSTRAINT package_info_packing_type_id_fkey FOREIGN KEY (packing_type_id) REFERENCES public.packing_types(id),
  CONSTRAINT package_info_box_type_id_fkey FOREIGN KEY (box_type_id) REFERENCES public.box_type(id)
);
CREATE TABLE public.package_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_package_id uuid NOT NULL,
  quantity integer,
  designation character varying,
  length numeric,
  width numeric,
  height numeric,
  CONSTRAINT package_items_pkey PRIMARY KEY (id),
  CONSTRAINT package_items_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id)
);
CREATE TABLE public.packer_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  packer_id uuid,
  order_id uuid,
  order_name text,
  client_name text,
  project_lead_name text,
  team_selected boolean DEFAULT false,
  attendance_completed boolean DEFAULT false,
  packaging_started boolean DEFAULT false,
  session_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT packer_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT packer_sessions_packer_id_fkey FOREIGN KEY (packer_id) REFERENCES public.profiles(id),
  CONSTRAINT packer_sessions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.packing_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  includes_contact boolean DEFAULT false,
  includes_waterproofing boolean DEFAULT false,
  includes_gas_protection boolean DEFAULT false,
  includes_vibration_protection boolean DEFAULT false,
  base_material_type text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  includes_vacuum_protection boolean DEFAULT false,
  CONSTRAINT packing_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  username text UNIQUE,
  phone_number text,
  role_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'blocked'::text, 'banned'::text])),
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  packer_status text DEFAULT 'available'::text CHECK (packer_status = ANY (ARRAY['available'::text, 'busy'::text, 'unavailable'::text])),
  current_order_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT profiles_current_order_id_fkey FOREIGN KEY (current_order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  can_block_users boolean DEFAULT false,
  can_unblock_users boolean DEFAULT false,
  can_ban_users boolean DEFAULT false,
  can_reset_passwords boolean DEFAULT false,
  can_delete_profiles boolean DEFAULT false,
  can_manage_roles boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.securing_template (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quantity integer,
  type_id uuid,
  thickness numeric,
  horizontal_bar uuid,
  vertical_bar uuid,
  skids uuid,
  CONSTRAINT securing_template_pkey PRIMARY KEY (id),
  CONSTRAINT securing_template_skids_fkey FOREIGN KEY (skids) REFERENCES public.beam(id),
  CONSTRAINT securing_template_horizontal_bar_fkey FOREIGN KEY (horizontal_bar) REFERENCES public.beam(id),
  CONSTRAINT securing_template_vertical_bar_fkey FOREIGN KEY (vertical_bar) REFERENCES public.beam(id),
  CONSTRAINT securing_template_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.material_variants(id)
);
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service text NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.supplier_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_variant_id uuid NOT NULL,
  price numeric NOT NULL DEFAULT '0'::numeric,
  updated_at timestamp with time zone DEFAULT now(),
  supplier_id uuid NOT NULL,
  price_per_unit numeric NOT NULL DEFAULT '0'::numeric,
  supplier_quantity numeric NOT NULL DEFAULT '0'::numeric,
  suppliers_reference text,
  pending_approval boolean DEFAULT false,
  approval_status text DEFAULT 'approved'::text CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  requested_by uuid,
  requested_at timestamp with time zone,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  admin_notes text,
  order_package_context uuid,
  CONSTRAINT supplier_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT supplier_pricing_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id),
  CONSTRAINT supplier_pricing_material_variant_id_fkey FOREIGN KEY (material_variant_id) REFERENCES public.material_variants(id),
  CONSTRAINT supplier_pricing_order_package_context_fkey FOREIGN KEY (order_package_context) REFERENCES public.order_packages(id),
  CONSTRAINT supplier_pricing_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  CONSTRAINT supplier_pricing_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  other_info text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.task_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  packer_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  task_status USER-DEFINED DEFAULT 'in_progress'::task_status,
  CONSTRAINT task_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT task_assignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_logs(id),
  CONSTRAINT task_assignments_packer_id_fkey FOREIGN KEY (packer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.task_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  duration_minutes numeric,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  task_id uuid,
  pause_duration numeric,
  update_counter integer,
  restart_time timestamp with time zone,
  CONSTRAINT task_logs_pkey PRIMARY KEY (id),
  CONSTRAINT task_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.task_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_log_id uuid,
  order_package_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_packages_pkey PRIMARY KEY (id),
  CONSTRAINT task_packages_task_log_id_fkey FOREIGN KEY (task_log_id) REFERENCES public.task_logs(id),
  CONSTRAINT task_packages_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id)
);
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.temporary_privileges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  granted_role_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  reason text,
  granted_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT temporary_privileges_pkey PRIMARY KEY (id),
  CONSTRAINT temporary_privileges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT temporary_privileges_granted_role_id_fkey FOREIGN KEY (granted_role_id) REFERENCES public.roles(id),
  CONSTRAINT temporary_privileges_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.transportation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  vehicle_type text,
  transport_date date NOT NULL,
  distance_km numeric,
  cost_per_unit numeric,
  unit_id uuid,
  total_cost numeric NOT NULL,
  notes text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transportation_pkey PRIMARY KEY (id),
  CONSTRAINT transportation_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT transportation_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units_of_measure(id),
  CONSTRAINT transportation_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.units_of_measure (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT units_of_measure_pkey PRIMARY KEY (id)
);