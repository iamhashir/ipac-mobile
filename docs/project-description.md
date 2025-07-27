1. High-Level Purpose of the App
The application is a robust operational management tool designed for a company specializing in industrial packaging and preservation services. Its core mission is to fully digitize and streamline the entire end-to-end workflow, from the initial client order and material procurement to detailed production tracking, team management, precise cost analysis, and comprehensive system auditing.

The app aims to achieve the following:

Centralized Order & Project Management: Provide a single source of truth for all client orders, breaking them down into manageable production packages, and tracking their commercial and production statuses.

Granular User & Access Control: Implement a robust role-based access control system (roles) with detailed permissions, including the ability for high-authority users (like 'director' or 'admin') to manage other user accounts (profiles) through status changes (block, ban) and password resets.

Optimized Materials & Costing: Maintain an accurate and real-time catalog of raw materials, their specific variants, associated suppliers, and dynamic pricing, enabling precise estimated cost calculations and tracking of actual material consumption.

Enhanced Production Visibility & Efficiency: Offer real-time insights into the progress of each package, facilitate logging of tasks performed by the packing team, and track workforce attendance and time spent on projects.

Comprehensive Financial Tracking: Monitor and aggregate all costs associated with an order, including materials, labor (implicitly via task logs), and transportation.

Improved Accountability & Security: Maintain an immutable and detailed audit trail (audit_log) of all critical system changes, data modifications, and sensitive user actions, providing transparency and supporting compliance.

Data-Driven Decision Making: Facilitate reporting and analytics on various operational aspects, such as project profitability, material usage, and team productivity.

2. A Detailed Explanation of the Database and Table Relationships (Including New Security Features)
The database schema is meticulously designed to reflect and support the operational workflow, with each table serving a specific function and connecting to others via foreign keys to establish meaningful relationships.

Group 1: Core Entities & Enhanced User Management
These tables form the absolute foundation, defining who can use the system, what their capabilities are, and who the customers are. The updates here are crucial for the application's security and administrative hierarchy.

public.roles (Updated)
Purpose: This table is the cornerstone of the application's Role-Based Access Control (RBAC) system. It defines various user roles within the organization and, critically, specifies the exact administrative permissions associated with each role. This allows for fine-grained control over who can perform sensitive actions.

Columns:

id: Primary key (UUID).

name: The unique name of the role (e.g., 'director', 'admin', 'packer', 'project_lead', 'sales'). This is used for display and internal logic.

can_block_users: Boolean. If TRUE, users with this role can set public.profiles.status to 'blocked'.

can_unblock_users: Boolean. If TRUE, users with this role can set public.profiles.status back to 'active' from 'blocked'.

can_ban_users: Boolean. If TRUE, users with this role can set public.profiles.status to 'banned'. This is typically the most severe action.

can_reset_passwords: Boolean. If TRUE, users with this role can initiate password reset flows for other users.

can_delete_profiles: Boolean. If TRUE, users with this role can remove other user profiles from the system.

can_manage_roles: Boolean. If TRUE, users with this role can assign and change the role_id of other users. This permission is typically reserved for the highest authority, the 'director'.

created_at, updated_at: Timestamps for record management.

Links: public.profiles.role_id is a foreign key that references public.roles.id. This is the direct link that assigns a user to a specific role and thus grants them the associated permissions defined in this table.

public.profiles (Updated)
Purpose: Stores all human-related data for every authenticated user of the application. It extends the basic user information from Supabase Auth (auth.users) with application-specific details like their full name, contact, and, most importantly, their assigned role and current account status.

Columns:

id: Primary key (UUID). This id is a foreign key that references auth.users.id (from Supabase's internal authentication schema) with ON DELETE CASCADE. This ensures that if a user account is deleted from Supabase Auth, their corresponding profile data is also removed, maintaining data integrity.

full_name, username, phone_number, avatar_url: Personal details of the user. username is crucial for operational roles like packers for easier identification. phone_number might be used for initial password setup or contact, but not for storing plaintext passwords.

role_id: Foreign key linking to public.roles.id. This determines the user's permissions.

status: New and Critical. TEXT field with a CHECK constraint, allowing only 'active', 'blocked', or 'banned'. This controls a user's access to the application, enabled by roles with can_block_users, can_unblock_users, can_ban_users permissions.

Links:

public.profiles.id references auth.users.id.

public.orders.created_by and public.orders.project_lead_id both reference public.profiles.id, indicating who initiated an order and who is leading it.

public.task_logs.packer_id references public.profiles.id, recording who performed a specific task.

public.order_teams.packer_id references public.profiles.id, for assigning packers to orders.

public.audit_log.changed_by references public.profiles.id, tracking which user made a system change.

public.attendance_logs.packer_id references public.profiles.id, for recording attendance.

public.clients
Purpose: Stores comprehensive information about all the company's external clients or customers.

Columns: id, name, contact_person, email, phone, address.

Links: public.orders.client_id is a foreign key that references public.clients.id, directly associating each order with the client who placed it. This allows for client-specific reporting and management.

Group 2: The Production & Packaging Core
These tables represent the central operational flow, from a high-level order down to individual packed items, their material breakdown, and the human effort involved.

public.orders
Purpose: The central project record. Each entry represents a single client order and acts as the umbrella for all associated packages, materials, labor, and costs.

Columns:

id: Primary key (UUID).

client_id: Foreign key linking to public.clients.id.

order_name, description: Descriptive details of the specific order/project.

commercial_status: Tracks the order's state from a sales/commercial perspective (e.g., 'draft', 'quoted', 'approved', 'invoiced', 'paid').

production_status: Tracks the order's state from an operational/production perspective (e.g., 'pending', 'in_progress', 'completed', 'on_hold').

total_estimated_cost, total_actual_cost, total_transportation_cost: Aggregated financial metrics for the entire order.

project_lead_id: Foreign key linking to public.profiles.id, identifying the internal project manager.

created_by: Foreign key linking to public.profiles.id, identifying who initially created the order record.

start_date, completion_date: Key project timeline dates.

Links:

public.orders.client_id references public.clients.id.

public.orders.project_lead_id and public.orders.created_by both reference public.profiles.id.

public.order_packages.order_id is a foreign key that references public.orders.id. This is a crucial one-to-many relationship, meaning one order can have many individual order_packages (items to be packed).

public.order_teams.order_id references public.orders.id, associating a team with a project.

public.transportation.order_id references public.orders.id, linking transport costs directly to the order.

public.attendance_logs.order_id references public.orders.id, tracking which packers worked on which order.

public.audit_log.order_id references public.orders.id, allowing for easy filtering of audit events by project.

public.packing_types
Purpose: Standardizes and defines the various categories of packaging services offered by the company (e.g., '4A' for Contact Wood, '4B' for Waterproofing). This table stores the inherent properties of each packing type, which can then be used in calculation logic.

Columns: id, code (e.g., '4A'), name (e.g., 'Contact Wood'), description, and various boolean flags (includes_contact, includes_waterproofing, etc.) indicating what each packing type entails. base_material_type could suggest default materials.

Links: public.order_packages.packing_type_id is a foreign key that references public.packing_types.id, specifying the type of packing applied to a particular equipment piece.

public.order_packages
Purpose: Represents an individual item or piece of equipment that needs to be packed within a larger order. Each order can consist of one or many order_packages, and each package has its own unique set of requirements, dimensions, and materials.

Columns:

id: Primary key (UUID).

order_id: Foreign key linking to public.orders.id. This is the parent link, crucial for understanding which package belongs to which order.

package_number: A sequential number (e.g., 1, 2, 3) to uniquely identify packages within a specific order (enforced by UNIQUE (order_id, package_number)).

description: A brief description of the item being packed.

packing_type_id: Foreign key linking to public.packing_types.id, defining the specific type of packing applied.

equipment_original_dimensions, equipment_final_dimensions, equipment_original_net_weight_kg, equipment_final_net_weight_kg: Store both the planned and actual measurements/weights of the equipment itself. Using JSONB for dimensions allows for flexible schema (e.g., { "length": 100, "width": 50, "height": 30 }).

box_internal_original_dimensions, box_internal_final_dimensions, box_external_original_dimensions, box_external_final_dimensions: Store the planned and actual internal and external dimensions of the wooden box or crates constructed for the equipment. Also JSONB.

status: Tracks the current state of this individual package (e.g., 'design', 'approved', 'in_production', 'packed', 'delivered').

Links:

public.order_packages.order_id references public.orders.id.

public.order_packages.packing_type_id references public.packing_types.id.

public.order_package_materials.order_package_id is a foreign key that references public.order_packages.id, establishing a one-to-many relationship where each package consumes multiple types of materials.

public.task_logs.order_package_id references public.order_packages.id, linking specific tasks performed by packers to the package they worked on.

public.order_teams
Purpose: A join table to manage the many-to-many relationship between orders and profiles. It defines which packers are assigned to work on a particular order.

Columns:

order_id: Foreign key linking to public.orders.id.

packer_id: Foreign key linking to public.profiles.id.

Links: A composite primary key (order_id, packer_id) ensures a unique assignment. This table facilitates team assignments for project management and subsequent labor cost tracking.

public.task_logs
Purpose: Records the individual, granular tasks performed by packers on specific order_packages. This is crucial for tracking labor, progress, and calculating actual labor costs for a project.

Columns:

id: Primary key (UUID).

order_package_id: Foreign key linking to public.order_packages.id, specifying which item the task was performed on.

packer_id: Foreign key linking to public.profiles.id, identifying who performed the task.

task_name: A description of the task (e.g., 'Cutting wood for base', 'Applying waterproofing film').

start_time, end_time: Timestamps for task duration.

duration_minutes: Calculated duration of the task.

notes: Any additional comments from the packer.

Links: public.task_logs.order_package_id references public.order_packages.id, and public.task_logs.packer_id references public.profiles.id. This provides a detailed audit of "who did what, on which package, and when."

Group 3: Materials & Supply Chain Management
These tables manage the entire material catalog, from high-level categories to specific variants, their suppliers, and the pricing information. This is critical for accurate cost estimation and inventory management.

public.materials
Purpose: Defines high-level, generic categories of raw materials (e.g., "Wood," "Steel," "Plastic Film," "Desiccants"). This provides a broad classification.

Columns: id, name, description.

Links: public.material_variants.material_id is a foreign key that references public.materials.id, establishing a one-to-many relationship where one generic material can have many specific variants.

public.material_variants
Purpose: Represents the specific, distinct items of material that are actually purchased and used (e.g., "Plywood 12mm thick," "Timber 100x75mm," "Plastic Film 5m wide - high barrier"). These are the tangible products.

Columns:

id: Primary key (UUID).

material_id: Foreign key linking to public.materials.id.

variant_name: A unique and descriptive name for the specific variant.

attributes: A JSONB column to store flexible, key-value pair attributes specific to the variant (e.g., {"thickness": "12mm", "grade": "B/BB"}, {"width": "5m", "type": "high barrier"}).

Links:

public.material_variants.material_id references public.materials.id.

public.supplier_pricing.material_variant_id references public.material_variants.id, providing pricing information for this specific variant from different suppliers.

public.order_package_materials.material_variant_id references public.material_variants.id. This is the crucial link that pulls specific material variants into the bill of materials for each order_package.

public.material_tags.material_id implicitly links through material_tags to materials, which then relates to material_variants.

public.units_of_measure
Purpose: A master lookup table for all standardized units used throughout the system. This ensures consistency and accuracy in quantities, prices, and dimensions (e.g., 'm2', 'Pce', 'kg', 'm', 'hour', 'trip').

Columns: id, name, description.

Links: Used as a foreign key in multiple tables: public.order_package_materials.unit_id, public.supplier_pricing.unit_id, and public.transportation.unit_id. This ensures all measurements and costs are tied to a defined unit.

public.suppliers
Purpose: Stores detailed information about all external material suppliers.

Columns: id, name, contact_info (JSONB for flexible contact details).

Links: public.supplier_pricing.supplier_id is a foreign key that references public.suppliers.id, establishing a relationship that identifies where a particular material price comes from.

public.supplier_pricing
Purpose: This is a crucial join table that records the specific cost of a material_variant when purchased from a particular supplier. It allows for tracking different prices for the same material from various sources and optionally includes inventory levels.

Columns:

id: Primary key (UUID).

material_variant_id: Foreign key linking to public.material_variants.id.

supplier_id: Foreign key linking to public.suppliers.id.

price: The cost of the material from this supplier.

unit_id: Foreign key linking to public.units_of_measure.id, defining the unit for this price.

stock_level: Current stock quantity from this supplier (optional, could be for direct inventory management).

Links: This table creates a many-to-many relationship between material_variants and suppliers. It is essential for accurate cost estimation for order_package_materials, as the system needs to retrieve the current or estimated price of a material variant.

public.order_package_materials
Purpose: This is the Bill of Materials (BOM) for each specific order_package. It details which material_variant is used for a particular package, in what quantities (calculated vs. actual), and at what cost.

Columns:

id: Primary key (UUID).

order_package_id: Foreign key linking to public.order_packages.id, defining which package this material is part of.

material_variant_id: Foreign key linking to public.material_variants.id, specifying the exact material item.

quantity_calculated: The theoretically required quantity based on design/calculations.

unit_id: Foreign key linking to public.units_of_measure.id.

quantity_actual: The actual quantity of material consumed during production. This is often updated by packers.

cost_at_calculation: The cost of the material when the calculation was made (e.g., based on supplier_pricing). This is a snapshot to compare against cost_actual.

cost_actual: The actual cost incurred for this specific material usage.

usage_details: JSONB for specific details about how the material is used (e.g., 'side panels', 'base support'). Combined with order_package_id and material_variant_id, this forms a UNIQUE constraint to prevent duplicate entries for the exact same material usage.

notes: Any additional notes about the material usage.

Links: This table sits at the heart of material consumption, linking order_packages to material_variants and units_of_measure. It's the key to calculating actual material costs for an order.

public.tags
Purpose: Provides a flexible way to categorize and filter materials using arbitrary labels (e.g., 'fire-retardant', 'heavy-duty', 'waterproof').

Columns: id, name.

Links: public.material_tags.tag_id references public.tags.id.

public.material_tags
Purpose: A join table to establish a many-to-many relationship between materials and tags. A material can have multiple tags, and a tag can be applied to multiple materials.

Columns:

material_id: Foreign key linking to public.materials.id.

tag_id: Foreign key linking to public.tags.id.

Links: Provides flexible material categorization.

Group 5: Logistics, Tracking, and Comprehensive Auditing
These tables capture critical auxiliary data related to logistics, workforce attendance, and, crucially, a complete, immutable record of all significant system events and data changes, which is vital for security and compliance.

public.transportation
Purpose: Records detailed information and costs associated with transporting the packed goods for an order.

Columns: id, order_id, vehicle_type, transport_date, distance_km, cost_per_unit, unit_id, total_cost, notes, recorded_by.

Links: public.transportation.order_id references public.orders.id, linking transport expenses directly to the relevant project. recorded_by references public.profiles.id to track who logged the transportation.

public.attendance_logs
Purpose: Records the daily attendance of packers assigned to specific orders. This helps track labor hours and identify workforce presence.

Columns:

id: Primary key (UUID).

order_id: Foreign key linking to public.orders.id, indicating the order the packer was assigned to.

packer_id: Foreign key linking to public.profiles.id, identifying the packer.

log_date, shift_period (morning, afternoon, full_day), status (present, absent), start_time, end_time: Details about the attendance session.

Links: This table provides a specific linkage between orders and profiles for attendance tracking, complementing order_teams for assignment.

public.audit_log (Updated)
Purpose: This is a critical security and accountability table. It serves as an immutable log of all significant changes made to data, administrative actions, and system alerts. Its primary use is for auditing, troubleshooting, and ensuring data integrity and compliance.

Columns:

id: Primary key (UUID).

entity_type: TEXT (e.g., 'order', 'order_package', 'profile', 'supplier_pricing'). Identifies which table/type of data was affected.

entity_id: UUID. The id of the specific record that was affected (e.g., the id of the order that was updated).

column_name: TEXT. The specific column that was changed (optional, not always applicable for 'INSERT' or system-level actions).

old_value: JSONB. The data before the change.

new_value: JSONB. The data after the change.

changed_by: Foreign key linking to public.profiles.id, identifying which user initiated the action or change. This is paramount for accountability.

change_time: TIMESTAMPTZ. When the change occurred.

action_type: TEXT with a CHECK constraint. This updated list now includes more specific actions crucial for security and user management:

INSERT, UPDATE, DELETE: Standard CRUD operations.

ALERT: For system-generated critical alerts.

PASSWORD_RESET: Logs when a password reset is initiated (by an admin/director).

BLOCK_USER, UNBLOCK_USER, BAN_USER: Specific actions taken on user profiles.status.

ROLE_CHANGE: Logs when a user's role_id is modified.

PROFILE_DELETE: Logs when a user's profile is removed.

is_critical_alert: Boolean. Flag to quickly identify high-priority events in the log.

notes: Any additional descriptive notes about the audit event.

order_id: Foreign key linking to public.orders.id. This direct link allows for easy filtering of audit events related to a specific project.

Links:

public.audit_log.changed_by references public.profiles.id.

public.audit_log.order_id references public.orders.id.

While audit_log does not have direct foreign key constraints to every table it logs changes for (as entity_id is generic UUID), it implicitly "watches" various tables (e.g., orders, order_packages, profiles, supplier_pricing) through database triggers or application-level logging to capture changes to their data.




Application Development Guidelines for Warp AI App Builder
This document outlines the core purpose, technical stack, architectural principles, security considerations, and specific instructions for building the "Packer Management & Costing" application. The application's architecture must prioritize modularity, reusability, and maintainability to ensure scalability and ease of future development. This revision specifically aligns the structure with Expo Router.

links for expo documentation:
https://docs.expo.dev/
https://docs.expo.dev/get-started/start-developing/

1. Application Purpose & Vision
The primary goal of this application is to revolutionize the current Excel-based packaging and preservation workflow into a modern, efficient, and secure digital system.

Core Objectives:

Streamlined Order & Project Management: Digitize the entire lifecycle from client order placement, surveyor input, to final package delivery.

Automated Costing & Material Management: Provide intelligent, automated calculations for material needs and costs based on equipment dimensions and packing types, while allowing for manual overrides and real-time adjustments.

Enhanced Production Visibility: Offer real-time tracking of individual package progress, detailed task logging by packers, and comprehensive attendance records.

Robust Accountability & Security: Implement granular access control, track all critical system changes and user actions via an audit log, and ensure data integrity.

Improved Reporting: Generate accurate reports on costs, material consumption, and workforce productivity.

Target Users & Platforms:

Admin Users: Will use a Desktop Application. They require full access to order management, costing, material catalogs, user management, and detailed reporting.

Packer Users: Will use a Mobile Tablet Application. They require a simplified, intuitive interface focused on logging tasks, updating package details (dimensions, materials), and tracking their attendance.

2. Technical Stack Explanation
The application will be built using a modern, robust, and scalable technology stack:

React Native: The core framework for building native mobile and desktop applications using JavaScript/TypeScript. It allows for a single codebase across multiple platforms, saving development time and ensuring consistency.

Expo: A powerful framework and platform built on top of React Native. Expo simplifies development by providing a managed workflow, pre-built APIs, and easy deployment tools. It handles native build processes, making development faster and more accessible.

Supabase: Our backend-as-a-service (BaaS) provider. Supabase offers a PostgreSQL database, authentication, real-time subscriptions, and storage. It is crucial for:

Database: Storing all application data (orders, materials, users, tasks, etc.).

Authentication: Managing user logins, sessions, and roles.

Row Level Security (RLS): Enforcing granular access control directly at the database level.

Realtime: Potentially enabling live updates in the admin dashboard.

NativeWind: A utility-first CSS framework for React Native, inspired by Tailwind CSS. NativeWind allows for rapid UI development by applying styles directly in JSX using a consistent, responsive design system. It ensures a clean and maintainable styling approach.

3.1. Modularity and Component-Based Development
Rule: Break down the UI into small, reusable, and self-contained components.

Explanation: Instead of monolithic screens, identify distinct UI elements (e.g., a "UserCard," an "OrderSummary," a "MaterialInputRow"). Each component should have a single responsibility. This promotes reusability across different screens and platforms (e.g., a MaterialInput component could be used in both admin and packer views).

3.2. Folder Structure (Revised for Expo Router)
Rule: The app/ directory is the root of our navigation stack. The directory structure will define our routes. We will use a group folder for each user role to separate the navigation and logic.

Explanation:

Project Root:

app/: This is the routing root.

(admin)/: A group folder for all Admin-specific screens. The parentheses () hide this folder from the URL, so app/(admin)/dashboard.js becomes /dashboard.

_layout.js: The layout file for the admin tab navigator, ensuring consistent header/footer and navigation for all admin pages.

index.js or dashboard.js: The main dashboard page for the admin.

orders/: A folder for all order-related screens.

_layout.js: Layout for the orders section.

index.js: The list of all orders.

[id].js: The dynamic route for a single order's details page.

(packer)/: A group folder for all Packer-specific screens.

_layout.js: The layout file for the packer tab navigator.

index.js or dashboard.js: The main dashboard for packers.

my-orders.js: A page listing a packer's assigned orders.

my-orders/[id].js: The details page for a specific assigned order.

auth/: Screens for authentication (Login, Register). These will be outside the group folders and can be the initial route.

_layout.js: The main application layout, used for authentication checks and redirecting users to the correct (admin) or (packer) layout.

components/: Reusable UI components.

common/: Components used across both Admin and Packer apps.

admin/: Components specific to the Admin UI.

packer/: Components specific to the Packer UI.

hooks/: Custom React Hooks.

utils/: Utility functions.

api/: Supabase client and data fetching functions.

constants/: Global constants.

3.3. Styling with NativeWind
Rule: Use NativeWind exclusively for styling components.

Explanation: Apply Tailwind CSS classes directly in JSX. This ensures consistent styling, easy theming, and responsive design. Avoid inline style objects or separate StyleSheet.create blocks unless absolutely necessary.

3.4. State Management
Rule: For local component state, use useState. For global application state (e.g., user session, current order being viewed), prefer React Context API or a lightweight state management library like Zustand.

Explanation: Keep component state localized. For data needed across many components, a global store makes data access cleaner.

3.5. Navigation (Revised for Expo Router)
Rule: Utilize Expo Router for all application navigation. The file-based routing automatically handles route creation.

Explanation: The _layout.js files are central to this. The root app/_layout.js will contain logic to check if a user is authenticated. If they are, it will render the appropriate layout based on their role_id from the profiles table (e.g., (admin) or (packer)). If not, it will redirect them to the auth screen. Each group folder's _layout.js will define the navigation (e.g., tab bar or drawer) for that specific user type.

3.6. Data Fetching & Mutations
Rule: Interact with the Supabase backend using the official Supabase JavaScript client library. Encapsulate data operations within dedicated API service files or custom hooks.

Explanation: All data interactions should go through the Supabase client. Implement try-catch blocks for robust error handling.

3.7. Error Handling & User Feedback
Rule: Implement comprehensive error handling and provide clear and actionable feedback to the user for all operations (success, loading, error states).

Explanation: Use loading indicators during data fetches. Display user-friendly error messages instead of raw technical errors.

4. Security Guidelines
Security is paramount, especially with sensitive user data and operational control.

Supabase Row Level Security (RLS):

Rule: RLS policies, as defined in the provided SQL script, are the primary access control mechanism. The application MUST respect and rely on these policies.

Explanation: Do not attempt to bypass RLS on the client-side. All data operations should be performed as the authenticated user, allowing Supabase to enforce what they can see and modify.

Authentication:

Rule: Use Supabase's built-in authentication for user logins. For packers, prioritize Supabase Phone Authentication (OTP) for simplicity and security. If OTP is not feasible, use standard email/password, with admins creating accounts using fake emails and simple initial passwords.

Explanation: Never store passwords in plaintext. Rely on Supabase's secure hashing.

Input Validation:

Rule: Implement both client-side and server-side (via Supabase database constraints, triggers, or Edge Functions) input validation.

Explanation: Prevent invalid or malicious data from entering the database.

Sensitive Data Handling:

Rule: Do not store sensitive information (e.g., API keys, full user credentials) directly in the client-side code.

Explanation: Use environment variables for API keys. Supabase client handles tokens securely.

Audit Logging (public.audit_log):

Rule: Every critical action (user creation/deletion/status change/role change, sensitive data modification, manual overrides on order packages/materials) MUST trigger an entry in the public.audit_log table.

Explanation: This provides an immutable record of "who did what, when, and what changed," crucial for accountability and troubleshooting. The "Alert Office" button should trigger a specific is_critical_alert = TRUE entry in the audit_log.

5. Deployment & Platform Specifics
The application needs to adapt its UI and functionality based on the target platform and user role.

5.1. Admin Application (Desktop)
Platform: React Native for Desktop (via Expo).

UI/UX: Design for larger screens, mouse/keyboard interaction. Prioritize data density, complex tables, filtering, and detailed forms.

Features: Full access to all admin pages described in the previous section (Orders, Materials, Users, Clients, Reports, Audit Log).

5.2. Packer Application (Tablet)
Platform: React Native for Mobile (via Expo), specifically optimized for Tablets.

UI/UX:

Responsive Design: Ensure layouts adapt well to various tablet sizes and orientations (portrait/landscape).

Touch-Friendly: Large touch targets for buttons and input fields.

Clarity: Clear, legible fonts and high contrast. Minimize clutter.

Intuitive Workflow: Streamlined flows for common packer tasks (logging attendance, starting/ending tasks, updating dimensions/materials).

Minimal Text Input: Prioritize dropdowns, toggles, and numerical inputs where possible to reduce typing.

Features:

Login (using username/phone number).

Dashboard: Overview of assigned orders, current tasks.

My Orders: List of orders assigned to the packer.

Package Detail: View/edit specific package details (dimensions, weights), log tasks, update material actuals, trigger "Alert Office" button.

Attendance Logging.

Limited access to material catalog (primarily for selection/substitution, not management).

No access to user management, client management, or detailed financial reports.

6. Warp AI Builder Specific Instructions
These instructions are directly for the Warp AI App Builder to ensure proper integration and development practices.

Expo Project Structure Adherence:

Rule: Strictly follow the standard Expo project structure. The main application entry point should be App.js or App.tsx (whichever is the default for the generated Expo project). Do NOT create a separate app.tsx file if the project's root is App.js or vice-versa, as this indicates a misunderstanding of Expo's main entry point.

Rule: Utilize Expo's built-in routing solution, Expo Router, for navigation. This means mapping screens to file paths within the app/ directory (e.g., app/(tabs)/index.js, app/admin/orders/[id].js).

Component Granularity & Organization:

Rule: When generating code, prioritize creating small, reusable components.

Rule: Place these components in the components/common/, components/admin/, and components/packer/ directories as outlined in Section 3.2.

Rule: Ensure screen components (e.g., OrderDetailScreen.js) are placed in screens/admin/ or screens/packer/.

NativeWind Usage:

Rule: All styling must be done using NativeWind classes directly within JSX.

Git Commit Strategy:

Rule: After every major feature implementation or significant set of changes (e.g., completing an entire page, implementing a core data flow, fixing a major bug), perform a Git commit to the provided GitHub repository.

Commit Message Format: Use clear and descriptive commit messages (e.g., "feat: Implement Admin Orders List Screen", "fix: Resolve RLS issue on profiles update", "refactor: Consolidate order/project entities").
