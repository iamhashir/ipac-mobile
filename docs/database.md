# IPAC Operations App - Database Documentation

## Table of Contents
1. [Overview](#overview)
2. [Entity Relationship Model](#entity-relationship-model)
3. [Tables Reference](#tables-reference)
4. [Functions & Views](#functions--views)
5. [Triggers](#triggers)
6. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
7. [Application Workflows](#application-workflows)
8. [Frontend Integration Guide](#frontend-integration-guide)
9. [Data Types & Conventions](#data-types--conventions)
10. [Maintenance](#maintenance)

---

## Overview

The IPAC Operations App database manages industrial packaging operations including:

- **Order Management**: Client orders with commercial and production status tracking
- **Team Assignment**: Dynamic packer assignment to orders with JSON-based team storage
- **Attendance Tracking**: Daily attendance logging with shift periods and toolbox briefings
- **Material Management**: Materials, variants, and supplier pricing for cost calculation
- **Package Tracking**: Detailed package specifications with dimensions and packing types
- **Task Logging**: Time tracking for specific packaging tasks
- **Transportation**: Vehicle logistics and cost tracking
- **Audit Trail**: Comprehensive audit logging for security and compliance

**Technology Stack**: PostgreSQL (Supabase), Row Level Security, UUID primary keys, JSONB for flexible data storage.

---

## Entity Relationship Model

### Core Relationships
```
clients ──1:N─→ orders ──1:N─→ order_packages ──1:N─→ order_package_materials
                    │             │
                    │             └─1:N─→ task_logs
                    │
                    ├─1:N─→ order_team_members ──N:1─→ profiles (junction table)
                    ├─1:N─→ attendance_logs
                    └─1:N─→ transportation

auth.users ──1:1─→ profiles ──N:1─→ roles
                     │
                     └─1:N─→ attendance_logs, task_logs, audit_log, order_team_members

materials ──1:N─→ material_variants ──1:N─→ order_package_materials
                                      └─1:N─→ supplier_pricing

packing_types ──1:N─→ order_packages
units_of_measure ──1:N─→ order_package_materials, supplier_pricing, transportation
```

---

## Tables Reference

### attendance_logs
**Purpose**: Tracks daily attendance for packers assigned to orders with shift periods and briefing completion.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `order_id` | `uuid` | - | NOT NULL, FK → orders(id) |
| `packer_id` | `uuid` | - | NOT NULL, FK → profiles(id) |
| `log_date` | `date` | `CURRENT_DATE` | NOT NULL |
| `shift_period` | `text` | - | NOT NULL, CHECK (morning/afternoon/full_day) |
| `status` | `text` | `'present'` | NOT NULL, CHECK (present/absent) |
| `start_time` | `timestamptz` | - | - |
| `end_time` | `timestamptz` | - | - |
| `toolbox_briefing_completed` | `boolean` | `false` | - |
| `is_project_start` | `boolean` | `false` | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Relationships**: 
- `order_id` → `orders.id`
- `packer_id` → `profiles.id`

**Business Logic**: Used for daily attendance tracking, payroll calculations, and project start documentation. The `shift_period` allows flexible scheduling with morning/afternoon or full-day shifts.

---

### audit_log
**Purpose**: Comprehensive audit trail for all system changes and security events.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `entity_type` | `text` | - | NOT NULL |
| `entity_id` | `uuid` | - | NOT NULL |
| `column_name` | `text` | - | - |
| `old_value` | `jsonb` | - | - |
| `new_value` | `jsonb` | - | - |
| `changed_by` | `uuid` | - | FK → profiles(id) |
| `change_time` | `timestamptz` | `now()` | - |
| `action_type` | `text` | - | NOT NULL, CHECK (INSERT/UPDATE/DELETE/ALERT/PASSWORD_RESET/BLOCK_USER/UNBLOCK_USER/BAN_USER/ROLE_CHANGE/PROFILE_DELETE) |
| `is_critical_alert` | `boolean` | `false` | - |
| `notes` | `text` | - | - |
| `order_id` | `uuid` | - | FK → orders(id) |
| `order_package_id` | `uuid` | - | FK → order_packages(id) |

**Business Logic**: Critical for compliance, security monitoring, and debugging. Automatically populated by triggers and manual logging for security events.

---

### clients
**Purpose**: Customer/client information for order management.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `name` | `text` | - | NOT NULL, UNIQUE |
| `contact_person` | `text` | - | - |
| `email` | `text` | - | - |
| `phone` | `text` | - | - |
| `address` | `text` | - | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Relationships**: 
- One-to-many with `orders`

**Business Logic**: Central client management for CRM and order tracking.

---

### materials
**Purpose**: Base materials used in packaging operations.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `name` | `text` | - | NOT NULL, UNIQUE |
| `description` | `text` | - | - |
| `created_at` | `timestamptz` | `now()` | - |

**Relationships**:
- One-to-many with `material_variants`
- Many-to-many with `tags` (via `material_tags`)

---

### material_variants
**Purpose**: Specific variants of materials with unique attributes.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `material_id` | `uuid` | - | NOT NULL, FK → materials(id) |
| `variant_name` | `text` | - | NOT NULL |
| `attributes` | `jsonb` | - | - |
| `created_at` | `timestamptz` | `now()` | - |

**Business Logic**: Enables flexible material specification (e.g., "Plywood 15mm", "Plywood 20mm") with custom attributes stored as JSON.

---

### order_package_materials
**Purpose**: Specific materials used in each package with calculated and actual quantities/costs.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `order_package_id` | `uuid` | - | NOT NULL, FK → order_packages(id) |
| `material_variant_id` | `uuid` | - | NOT NULL, FK → material_variants(id) |
| `quantity_calculated` | `numeric` | - | NOT NULL, CHECK (≥ 0) |
| `unit_id` | `uuid` | - | NOT NULL, FK → units_of_measure(id) |
| `quantity_actual` | `numeric` | - | - |
| `cost_actual` | `numeric` | - | - |
| `cost_at_calculation` | `numeric` | - | NOT NULL |
| `usage_details` | `jsonb` | - | - |
| `notes` | `text` | - | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Business Logic**: Critical for cost control - tracks both estimated and actual material usage. Enables variance analysis and inventory management.

---

### order_packages
**Purpose**: Individual packages within an order with detailed specifications and dimensions.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `order_id` | `uuid` | - | NOT NULL, FK → orders(id) |
| `package_number` | `integer` | - | NOT NULL |
| `description` | `text` | - | - |
| `packing_type_id` | `uuid` | - | FK → packing_types(id) |
| `equipment_original_dimensions` | `jsonb` | - | NOT NULL |
| `equipment_final_dimensions` | `jsonb` | - | - |
| `equipment_original_net_weight_kg` | `numeric` | - | NOT NULL |
| `equipment_final_net_weight_kg` | `numeric` | - | - |
| `box_internal_original_dimensions` | `jsonb` | - | - |
| `box_internal_final_dimensions` | `jsonb` | - | - |
| `box_external_original_dimensions` | `jsonb` | - | - |
| `box_external_final_dimensions` | `jsonb` | - | - |
| `status` | `text` | `'design'` | NOT NULL, CHECK (design/approved/in_production/packed/delivered) |
| `quantity` | `integer` | `1` | CHECK (> 0) |
| `boxes_completed` | `integer` | `0` | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Business Logic**: Core packaging entity tracking dimensional changes through the packaging process. JSONB dimensions allow flexible coordinate storage.

---

### order_team_members
**Purpose**: Junction table for team assignments linking orders to assigned packers using proper relational design.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `order_id` | `uuid` | - | NOT NULL, FK → orders(id) |
| `packer_id` | `uuid` | - | NOT NULL, FK → profiles(id) |
| `created_at` | `timestamptz` | `now()` | - |

**Relationships**:
- `order_id` → `orders.id`
- `packer_id` → `profiles.id`
- `UNIQUE(order_id, packer_id)` prevents duplicate assignments

**Business Logic**: Proper relational approach using junction table for many-to-many relationship between orders and packers. Provides better query performance, referential integrity, and easier complex operations. Triggers automatically update packer status when team assignments change.

---

### orders
**Purpose**: Main order entity tracking commercial and production lifecycle.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `client_id` | `uuid` | - | NOT NULL, FK → clients(id) |
| `order_name` | `text` | - | NOT NULL |
| `description` | `text` | - | - |
| `commercial_status` | `text` | `'draft'` | NOT NULL, CHECK (draft/quoted/approved/invoiced/paid) |
| `production_status` | `text` | `'pending'` | NOT NULL, CHECK (pending/in_progress/completed/on_hold) |
| `created_by` | `uuid` | - | FK → profiles(id) |
| `project_lead_id` | `uuid` | - | FK → profiles(id) |
| `start_date` | `timestamptz` | - | - |
| `completion_date` | `timestamptz` | - | - |
| `total_estimated_cost` | `numeric` | - | - |
| `total_actual_cost` | `numeric` | - | - |
| `total_transportation_cost` | `numeric` | `0.0` | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Business Logic**: Central order management with dual status tracking (commercial vs. production). Project lead assignment enables delegation and responsibility tracking.

---

### packing_types
**Purpose**: Standard packing methodologies with feature flags.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `code` | `text` | - | NOT NULL, UNIQUE |
| `name` | `text` | - | NOT NULL |
| `description` | `text` | - | - |
| `includes_contact` | `boolean` | `false` | - |
| `includes_waterproofing` | `boolean` | `false` | - |
| `includes_gas_protection` | `boolean` | `false` | - |
| `includes_vibration_protection` | `boolean` | `false` | - |
| `base_material_type` | `text` | - | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Business Logic**: Standardized packing specifications with feature-based classification. Codes like "4A", "4B" map to industry standards.

---

### profiles
**Purpose**: User profiles extending Supabase Auth with role-based permissions and packer status.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | - | PRIMARY KEY, FK → auth.users(id) |
| `full_name` | `text` | - | NOT NULL |
| `username` | `text` | - | UNIQUE |
| `phone_number` | `text` | - | - |
| `role_id` | `uuid` | - | NOT NULL, FK → roles(id) |
| `status` | `text` | `'active'` | NOT NULL, CHECK (active/blocked/banned) |
| `packer_status` | `text` | `'available'` | CHECK (available/busy/unavailable) |
| `current_order_id` | `uuid` | - | FK → orders(id) |
| `avatar_url` | `text` | - | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Business Logic**: Extended user management with packer-specific status tracking. Automatically updated by triggers when team assignments change.

---

### roles
**Purpose**: Role-based access control with granular permission flags.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `name` | `text` | - | NOT NULL, UNIQUE |
| `can_block_users` | `boolean` | `false` | - |
| `can_unblock_users` | `boolean` | `false` | - |
| `can_ban_users` | `boolean` | `false` | - |
| `can_reset_passwords` | `boolean` | `false` | - |
| `can_delete_profiles` | `boolean` | `false` | - |
| `can_manage_roles` | `boolean` | `false` | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Standard Roles**: `director` (all permissions), `admin`, `project_lead`, `sales`, `packer`

---

### supplier_pricing
**Purpose**: Material pricing from different suppliers for cost optimization.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `material_variant_id` | `uuid` | - | NOT NULL, FK → material_variants(id) |
| `supplier_id` | `uuid` | - | NOT NULL, FK → suppliers(id) |
| `price` | `numeric` | - | NOT NULL, CHECK (≥ 0) |
| `unit_id` | `uuid` | - | NOT NULL, FK → units_of_measure(id) |
| `stock_level` | `integer` | - | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Business Logic**: Enables competitive pricing and supplier comparison for material procurement.

---

### suppliers
**Purpose**: Supplier information with flexible contact storage.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `name` | `text` | - | NOT NULL, UNIQUE |
| `contact_info` | `jsonb` | - | - |
| `created_at` | `timestamptz` | `now()` | - |

---

### tags
**Purpose**: Flexible tagging system for materials categorization.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `name` | `text` | - | NOT NULL, UNIQUE |
| `created_at` | `timestamptz` | `now()` | - |

**Relationships**: Many-to-many with `materials` via `material_tags`

---

### task_logs
**Purpose**: Time tracking for specific packaging tasks.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `order_package_id` | `uuid` | - | NOT NULL, FK → order_packages(id) |
| `packer_id` | `uuid` | - | NOT NULL, FK → profiles(id) |
| `task_name` | `text` | - | NOT NULL |
| `start_time` | `timestamptz` | - | NOT NULL |
| `end_time` | `timestamptz` | - | - |
| `duration_minutes` | `numeric` | - | - |
| `notes` | `text` | - | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Business Logic**: Detailed time tracking for productivity analysis and accurate costing.

---

### transportation
**Purpose**: Vehicle logistics and transportation cost tracking.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `order_id` | `uuid` | - | NOT NULL, FK → orders(id) |
| `vehicle_type` | `text` | - | - |
| `transport_date` | `date` | - | NOT NULL |
| `distance_km` | `numeric` | - | - |
| `cost_per_unit` | `numeric` | - | - |
| `unit_id` | `uuid` | - | FK → units_of_measure(id) |
| `total_cost` | `numeric` | - | NOT NULL |
| `notes` | `text` | - | - |
| `recorded_by` | `uuid` | - | FK → profiles(id) |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

---

### units_of_measure
**Purpose**: Standardized units for quantities and measurements.

| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | PRIMARY KEY |
| `name` | `text` | - | NOT NULL, UNIQUE |
| `description` | `text` | - | - |
| `created_at` | `timestamptz` | `now()` | - |
| `updated_at` | `timestamptz` | `now()` | - |

**Standard Units**: `Pce` (pieces), `m2` (square meters), `kg` (kilograms), `m` (meters), `hour`, `trip`

---

## Functions & Views

### Core Business Functions

#### `assign_packers_to_order(order_uuid UUID, packer_ids UUID[])`
**Returns**: `BOOLEAN`  
**Security**: DEFINER  
**Purpose**: Assigns array of packers to an order using the junction table approach. Replaces existing assignments.

**Usage**:
```sql
SELECT assign_packers_to_order(
  'order-uuid-here'::uuid, 
  ARRAY['packer1-uuid', 'packer2-uuid']::uuid[]
);
```

**Supabase JS**:
```javascript
const { data, error } = await supabase.rpc('assign_packers_to_order', {
  order_uuid: orderId,
  packer_ids: selectedPackerIds
});
```

---

#### `get_available_packers()`
**Returns**: `TABLE(id uuid, full_name text, username text, packer_status text)`  
**Security**: DEFINER  
**Purpose**: Returns all active packers with 'available' status.

**Usage**:
```sql
SELECT * FROM get_available_packers();
```

---

#### `get_all_packers_with_status()`
**Returns**: `TABLE(id uuid, full_name text, username text, packer_status text, current_order_id uuid, current_order_name text)`  
**Security**: DEFINER  
**Purpose**: Returns all active packers with their current assignment details.

---

#### `get_order_packers(order_uuid UUID)`
**Returns**: `TABLE(packer_id uuid, full_name text, username text, packer_status text, assigned_at timestamptz)`  
**Security**: DEFINER  
**Purpose**: Returns all packers assigned to a specific order with assignment timestamp.

---

#### `get_busy_packers()`
**Returns**: `TABLE(id uuid, full_name text, username text, current_order_name text, current_order_id uuid)`  
**Security**: DEFINER  
**Purpose**: Returns all packers currently assigned to active orders.

---

#### `get_order_progress(order_uuid UUID)`
**Returns**: `TABLE(total_packages bigint, total_boxes bigint, completed_boxes bigint, completion_percentage numeric)`  
**Security**: DEFINER  
**Purpose**: Calculates order completion statistics.

---

#### `user_assigned_to_order(order_uuid UUID)`
**Returns**: `BOOLEAN`  
**Security**: DEFINER  
**Purpose**: Checks if current authenticated user is assigned to specified order.

---

#### `packer_logged_attendance_today(order_uuid UUID)`
**Returns**: `BOOLEAN`  
**Security**: DEFINER  
**Purpose**: Checks if current packer has logged attendance today for specified order.

---

#### `packer_needs_daily_attendance(packer_uuid UUID, order_uuid UUID, check_date DATE)`
**Returns**: `BOOLEAN`  
**Security**: DEFINER  
**Purpose**: Determines if packer needs to log attendance for specified date.

---

#### `get_user_role()`
**Returns**: `TEXT`  
**Security**: DEFINER  
**Purpose**: Returns the role name for current authenticated user.

---

#### `user_has_permission(permission_name TEXT)`
**Returns**: `BOOLEAN`  
**Security**: DEFINER  
**Purpose**: Checks if current user has specific permission based on role.

---

#### `can_be_project_lead(user_uuid UUID)`
**Returns**: `BOOLEAN`  
**Security**: DEFINER  
**Purpose**: Determines if specified user can be assigned as project lead.

---

#### `get_user_email_by_username(lookup_username TEXT)`
**Returns**: `TEXT`  
**Security**: DEFINER  
**Purpose**: Secure username-to-email lookup for authentication.

---

#### `update_project_lead_with_status(order_uuid UUID, lead_id UUID)`
**Returns**: `VOID`  
**Security**: DEFINER  
**Purpose**: Updates order project lead and automatically transitions order status.

---

### Views

#### `available_orders_for_assignment`
**Purpose**: Shows orders ready for team assignment with packer count.

**Columns**:
- `id`, `order_name`, `description`, `client_name`
- `production_status`, `commercial_status`
- `assigned_packers_count`

**Usage**:
```sql
SELECT * FROM available_orders_for_assignment 
WHERE assigned_packers_count = 0;
```

---

## Triggers

### `trigger_update_packer_status`
**Table**: `order_team_members`  
**Events**: AFTER INSERT, UPDATE, DELETE  
**Function**: `update_packer_status_on_assignment()`  

**Purpose**: Automatically updates packer status (available/busy) and current_order_id when team assignments change.

---

### `trigger_update_packer_status_on_completion`
**Table**: `orders`  
**Events**: AFTER UPDATE  
**Function**: `update_packer_status_on_order_completion()`  

**Purpose**: Marks all assigned packers as available when order is completed.

---

### `trigger_log_packer_status_change`
**Table**: `profiles`  
**Events**: AFTER UPDATE  
**Function**: `log_packer_status_change()`  

**Purpose**: Logs packer status changes to audit trail.

---

### `trigger_update_package_status`
**Table**: `order_packages`  
**Events**: BEFORE UPDATE  
**Function**: `update_package_status_on_completion()`  

**Purpose**: Automatically updates package status based on completion criteria.

---

## Row Level Security (RLS) Policies

### attendance_logs
**RLS**: Disabled  
- `Admin roles can read all attendance_logs` (SELECT)
- `Packers can create attendance_logs` (INSERT)
- `Packers can read own attendance_logs` (SELECT)

### audit_log
**RLS**: Disabled  
- `Admin can read audit_log` (SELECT)
- `System can insert audit_log` (INSERT)

### clients
**RLS**: Disabled  
- `Admin and sales can modify clients` (ALL)
- `Admin roles can read clients` (SELECT)

### order_team_members
**RLS**: Enabled  
- `Admin roles can modify order_team_members` (ALL)
- `Admin roles can read order_team_members` (SELECT)
- `Packers can read own order_team_members` (SELECT)

### orders
**RLS**: Disabled  
- `Admin roles can modify orders` (ALL)
- `Admin roles can read all orders` (SELECT)
- `Packers can read assigned orders` (SELECT)
- `Packers can see available orders for selection` (SELECT)

### profiles
**RLS**: Disabled  
- `Admin and director can create profiles` (INSERT)
- `Admin and director can read all profiles` (SELECT)
- `Privileged users can manage profiles` (UPDATE)
- `Users can read own profile` (SELECT)
- `Users can update own profile` (UPDATE)

### Common Pattern
Most tables allow:
- **Admin/Director**: Full access (ALL)
- **Authenticated users**: Read access (SELECT)
- **Record owners**: Read/update their own data

---

## Application Workflows

### 1. Order Lifecycle

**Phase 1: Order Creation**
1. `clients` → Create/select client
2. `orders` → Create order (status: draft/pending)
3. `order_packages` → Define package specifications
4. `order_package_materials` → Calculate material requirements

**Phase 2: Team Assignment**  
1. Query `get_available_packers()` for team selection
2. Call `assign_packers_to_order()` with selected packers
3. Trigger automatically updates `profiles.packer_status` to 'busy'
4. Order status transitions to 'in_progress'

**Phase 3: Daily Operations**
1. `attendance_logs` → Daily check-in with toolbox briefing
2. `task_logs` → Track specific packaging tasks
3. `order_packages` → Update completion progress

**Phase 4: Completion**
1. Order status → 'completed'
2. Trigger resets all packer statuses to 'available'
3. `transportation` → Record delivery logistics

---

### 2. Packer Assignment Flow

```mermaid
graph TD
    A[Select Order] --> B[Get Available Packers]
    B --> C[Select Team Members]
    C --> D[Assign Project Lead]
    D --> E[Call assign_packers_to_order()]
    E --> F[Update Packer Status via Trigger]
    F --> G[Order Status: in_progress]
```

---

### 3. Daily Attendance Flow

```mermaid
graph TD
    A[Packer Login] --> B[Check packer_needs_daily_attendance()]
    B --> C{Attendance Required?}
    C -->|Yes| D[Show Attendance Form]
    C -->|No| E[Navigate to Dashboard]
    D --> F[Log Attendance]
    F --> G[Complete Toolbox Briefing]
    G --> H[Start Work Session]
```

---

### 4. Material Management Flow

1. **Setup**: `materials` → `material_variants` → `supplier_pricing`
2. **Order Planning**: Calculate requirements in `order_package_materials`
3. **Actual Usage**: Update `quantity_actual` and `cost_actual`
4. **Analysis**: Compare calculated vs. actual for cost control

---

## Frontend Integration Guide

### Common Operations

#### 1. Assign Team to Order

```javascript
// Get available packers
const { data: packers } = await supabase.rpc('get_available_packers');

// Assign selected packers
const { data: teamId, error } = await supabase.rpc('assign_packers_to_order', {
  order_uuid: selectedOrderId,
  packer_ids: selectedPackerIds
});

// Update project lead
const { error: leadError } = await supabase.rpc('update_project_lead_with_status', {
  order_uuid: selectedOrderId,
  lead_id: projectLeadId
});
```

#### 2. Log Attendance

```javascript
// Check if attendance needed
const { data: needsAttendance } = await supabase.rpc('packer_needs_daily_attendance', {
  packer_uuid: currentUser.id,
  order_uuid: currentOrderId,
  check_date: new Date().toISOString().split('T')[0]
});

// Log attendance
const { error } = await supabase
  .from('attendance_logs')
  .insert({
    order_id: currentOrderId,
    packer_id: currentUser.id,
    shift_period: 'morning',
    status: 'present',
    start_time: new Date().toISOString(),
    toolbox_briefing_completed: true
  });
```

#### 3. Get Available Orders

```javascript
const { data: orders } = await supabase
  .from('available_orders_for_assignment')
  .select('*')
  .eq('production_status', 'pending');
```

#### 4. Track Task Time

```javascript
// Start task
const { data: taskLog } = await supabase
  .from('task_logs')
  .insert({
    order_package_id: packageId,
    packer_id: currentUser.id,
    task_name: 'Package Assembly',
    start_time: new Date().toISOString()
  })
  .select()
  .single();

// End task
const { error } = await supabase
  .from('task_logs')
  .update({
    end_time: new Date().toISOString(),
    duration_minutes: calculateDuration(startTime, endTime)
  })
  .eq('id', taskLog.id);
```

#### 5. Check User Permissions

```javascript
// Check if user can perform action
const { data: canManage } = await supabase.rpc('user_has_permission', {
  permission_name: 'can_manage_roles'
});

// Get user's role
const { data: userRole } = await supabase.rpc('get_user_role');
```

---

## Data Types & Conventions

### UUID Usage
- All primary keys use `uuid` with `gen_random_uuid()` default
- Foreign keys reference UUIDs for referential integrity
- Enables distributed systems and prevents ID enumeration attacks

### JSONB Storage
- **Dimensions**: `{width: 100, height: 50, depth: 30}` (cm)
- **Attributes**: Material-specific properties
- **Contact Info**: Flexible supplier/client contact storage
- **Team Arrays**: `["uuid1", "uuid2", "uuid3"]` for order_teams

### Timestamp Conventions
- All timestamps use `timestamptz` (timezone-aware)
- `created_at` and `updated_at` on all entities
- Automatic `now()` defaults with update triggers

### Status Enumerations
- **Order Commercial**: draft → quoted → approved → invoiced → paid
- **Order Production**: pending → in_progress → completed → on_hold
- **Package Status**: design → approved → in_production → packed → delivered
- **Packer Status**: available → busy → unavailable
- **User Status**: active → blocked → banned

---

## Maintenance

### Schema Updates
1. Update relevant `.sql` files in `/docs` folder
2. Test changes in development environment
3. Update this documentation file
4. Apply migrations via Supabase dashboard or CLI

### Function Modifications
- Functions use `SECURITY DEFINER` for elevated privileges
- Always test RLS policy interactions after function changes
- Update corresponding frontend integration examples

### Monitoring
- Monitor `audit_log` for security events
- Track performance of complex queries involving JSONB
- Regular index analysis on frequently queried columns

### Backup Strategy
- Supabase handles automated backups
- Export schema regularly: `supabase db dump --schema-only`
- Test restoration procedures

---

**Last Updated**: January 21, 2025  
**Schema Version**: 2.1.0  
**Supabase Project**: fqynbudvpvpiljdrrvem
