-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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
CREATE TABLE public.material_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  variant_name text NOT NULL,
  attributes jsonb,
  unit_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT material_variants_pkey PRIMARY KEY (id),
  CONSTRAINT material_variants_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT material_variants_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units_of_measure(id)
);
CREATE TABLE public.materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT materials_pkey PRIMARY KEY (id)
);
CREATE TABLE public.order_package_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_package_id uuid NOT NULL,
  material_variant_id uuid NOT NULL,
  quantity_calculated numeric NOT NULL CHECK (quantity_calculated >= 0::numeric),
  unit_id uuid NOT NULL,
  quantity_actual numeric,
  cost_actual numeric,
  cost_at_calculation numeric NOT NULL,
  usage_details jsonb,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_package_materials_pkey PRIMARY KEY (id),
  CONSTRAINT order_package_materials_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id),
  CONSTRAINT order_package_materials_material_variant_id_fkey FOREIGN KEY (material_variant_id) REFERENCES public.material_variants(id),
  CONSTRAINT order_package_materials_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units_of_measure(id)
);
CREATE TABLE public.order_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  package_number integer NOT NULL,
  description text,
  packing_type_id uuid,
  equipment_original_dimensions jsonb NOT NULL,
  equipment_final_dimensions jsonb,
  equipment_original_net_weight_kg numeric NOT NULL,
  equipment_final_net_weight_kg numeric,
  box_internal_original_dimensions jsonb,
  box_internal_final_dimensions jsonb,
  box_external_original_dimensions jsonb,
  box_external_final_dimensions jsonb,
  status text NOT NULL DEFAULT 'design'::text CHECK (status = ANY (ARRAY['design'::text, 'approved'::text, 'in_production'::text, 'packed'::text, 'delivered'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  quantity integer DEFAULT 1 CHECK (quantity > 0),
  boxes_completed integer DEFAULT 0,
  CONSTRAINT order_packages_pkey PRIMARY KEY (id),
  CONSTRAINT order_packages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_packages_packing_type_id_fkey FOREIGN KEY (packing_type_id) REFERENCES public.packing_types(id)
);
CREATE TABLE public.order_teams (
  order_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  packers_json jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT order_teams_pkey PRIMARY KEY (id),
  CONSTRAINT order_teams_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
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
CREATE TABLE public.supplier_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_variant_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  unit_id uuid NOT NULL,
  stock_level integer,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT supplier_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT supplier_pricing_material_variant_id_fkey FOREIGN KEY (material_variant_id) REFERENCES public.material_variants(id),
  CONSTRAINT supplier_pricing_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id),
  CONSTRAINT supplier_pricing_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units_of_measure(id)
);
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact_info jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.task_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_package_id uuid NOT NULL,
  packer_id uuid NOT NULL,
  task_name text NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  duration_minutes numeric,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_logs_pkey PRIMARY KEY (id),
  CONSTRAINT task_logs_order_package_id_fkey FOREIGN KEY (order_package_id) REFERENCES public.order_packages(id),
  CONSTRAINT task_logs_packer_id_fkey FOREIGN KEY (packer_id) REFERENCES public.profiles(id)
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




---------------------------------------------------------
functions:
Database Functions
Docs

schema

public

Search for a function

Create a new function

Name	Arguments	Return type	Security	

assign_packers_to_order
order_uuid uuid, packer_ids uuid[]

uuid

Definer	


can_be_project_lead
user_uuid uuid

boolean

Definer	


get_available_packers
-

TABLE(id uuid, full_name text, username text, packer_status text)

Definer	


get_busy_packers
-

TABLE(id uuid, full_name text, username text, current_order_name text, current_order_id uuid)

Definer	


get_order_packers
order_uuid uuid

TABLE(packer_id uuid, full_name text, username text, packer_status text)

Definer	


get_order_progress
order_uuid uuid

TABLE(total_packages bigint, total_boxes bigint, completed_boxes bigint, completion_percentage numeric)

Definer	


get_user_role
-

text

Definer	


log_packer_status_change
-

trigger

Invoker	


packer_logged_attendance_today
order_uuid uuid

boolean

Definer	


packer_needs_daily_attendance
packer_uuid uuid, order_uuid uuid, check_date date DEFAULT CURRENT_DATE

boolean

Definer	


update_package_status_on_completion
-

trigger

Invoker	


update_packer_status_on_assignment
-

trigger

Invoker	


update_packer_status_on_order_completion
-

trigger

Invoker	


user_assigned_to_order
order_uuid uuid

boolean

Definer	


user_has_permission
permission_name text

boolean

Definer	



-------------------------------------------------------------
triggers:
Name	Table	Function	Events	Orientation	Enabled	

trigger_log_packer_status_change	
profiles

log_packer_status_change

AFTER UPDATE
ROW


trigger_update_package_status	
order_packages

update_package_status_on_completion

BEFORE UPDATE
ROW


trigger_update_packer_status	
order_teams

update_packer_status_on_assignment

AFTER INSERT
AFTER DELETE
AFTER UPDATE
ROW


trigger_update_packer_status_on_completion	
orders

update_packer_status_on_order_completion

AFTER UPDATE
ROW

-----------------------------------------------------------
rsl policies:


attendance_logs

Disable RLS

Create policy

SELECT


Admin roles can read all attendance_logs
Applied to: public role

INSERT


Packers can create attendance_logs
Applied to: public role

SELECT


Packers can read own attendance_logs
Applied to: public role

audit_log

Disable RLS

Create policy

SELECT


Admin can read audit_log
Applied to: public role

INSERT


System can insert audit_log
Applied to: public role

clients

Disable RLS

Create policy

ALL


Admin and sales can modify clients
Applied to: public role

SELECT


Admin roles can read clients
Applied to: public role

material_tags

Disable RLS

Create policy

ALL


Admin can modify material_tags
Applied to: public role

SELECT


All authenticated can read material_tags
Applied to: public role

material_variants

Disable RLS

Create policy

ALL


Admin can modify material_variants
Applied to: public role

SELECT


All authenticated users can read material_variants
Applied to: public role

materials

Disable RLS

Create policy

ALL


Admin can modify materials
Applied to: public role

SELECT


All authenticated users can read materials
Applied to: public role

order_package_materials

Disable RLS

Create policy

ALL


Admin roles can modify order_package_materials
Applied to: public role

SELECT


Admin roles can read order_package_materials
Applied to: public role

UPDATE


Packers can update package_materials actuals
Applied to: public role

order_packages

Disable RLS

Create policy

ALL


Admin roles can modify order_packages
Applied to: public role

SELECT


Admin roles can read all order_packages
Applied to: public role

SELECT


Packers can read assigned order_packages
Applied to: public role

UPDATE


Packers can update assigned order_packages
Applied to: public role

order_teams

Enable RLS

Create policy

Warning:
Row Level Security is disabled. Your table is publicly readable and writable.
ALL


Admin roles can modify order_teams
Applied to: public role

SELECT


Admin roles can read order_teams
Applied to: public role

SELECT


Packers can read own order_teams
Applied to: public role

orders

Disable RLS

Create policy

ALL


Admin roles can modify orders
Applied to: public role

SELECT


Admin roles can read all orders
Applied to: public role

SELECT


Packers can read assigned orders
Applied to: public role

SELECT


Packers can see available orders for selection
Applied to: public role

packing_types

Disable RLS

Create policy

ALL


Admin can modify packing_types
Applied to: public role

SELECT


All authenticated can read packing_types
Applied to: public role

profiles

Disable RLS

Create policy

INSERT


Admin and director can create profiles
Applied to: public role

SELECT


Admin and director can read all profiles
Applied to: public role

UPDATE


Privileged users can manage profiles
Applied to: public role

SELECT


Users can read own profile
Applied to: public role

UPDATE


Users can update own profile
Applied to: public role

roles

Disable RLS

Create policy

SELECT


All authenticated users can read roles
Applied to: public role

ALL


Users with manage_roles permission can modify roles
Applied to: public role

supplier_pricing

Disable RLS

Create policy

ALL


Admin can modify supplier_pricing
Applied to: public role

SELECT


All authenticated can read supplier_pricing
Applied to: public role

suppliers

Disable RLS

Create policy

ALL


Admin can modify suppliers
Applied to: public role

SELECT


All authenticated can read suppliers
Applied to: public role

tags

Disable RLS

Create policy

ALL


Admin can modify tags
Applied to: public role

SELECT


All authenticated can read tags
Applied to: public role

task_logs

Disable RLS

Create policy

SELECT


Admin roles can read all task_logs
Applied to: public role

INSERT


Packers can create task_logs
Applied to: public role

SELECT


Packers can read own task_logs
Applied to: public role

UPDATE


Packers can update own task_logs
Applied to: public role

transportation

Disable RLS

Create policy

ALL


Admin roles can modify transportation
Applied to: public role

SELECT


Admin roles can read transportation
Applied to: public role

units_of_measure

Disable RLS

Create policy

ALL


Admin can modify units_of_measure
Applied to: public role

SELECT


All authenticated can read units_of_measure
Applied to: public role
