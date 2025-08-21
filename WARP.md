# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

The IPAC Operations App is a comprehensive React Native/Expo application for managing industrial packaging and preservation services. It digitalizes the entire workflow from client orders to production tracking, replacing Excel-based processes with an automated, secure system.

**Target Platforms:**
- Desktop app for Admin users (full functionality)
- Tablet app for Packer users (simplified interface)

**Key Tech Stack:**
- React Native + Expo (file-based routing)
- Supabase (PostgreSQL + Auth + Real-time)
- NativeWind (Tailwind CSS for React Native)
- TypeScript

## Development Commands

### Start Development Server
```bash
# Start Expo development server
npx expo start

# Platform-specific starts
npx expo start --android
npx expo start --ios
npx expo start --web
```

### Package Management
```bash
# Install dependencies
npm install

# Clear Expo cache (useful for build issues)
npx expo r -c
```

### Database Setup
1. Copy environment variables: `cp .env.example .env`
2. Add Supabase URL and API keys to `.env`
3. Run database setup from `docs/complete-database-setup.sql` in Supabase SQL Editor
4. Apply RLS policies from `docs/supabase-rls-policies.sql`

### MCP (Supabase) Integration
This project includes MCP tools for Supabase operations. Use these commands through the MCP interface:
- `execute_sql` - Run queries
- `apply_migration` - Apply DDL changes  
- `list_tables` - View database structure
- `get_advisors` - Check for security/performance issues

## Architecture Overview

### File Structure
```
app/
├── (admin)/          # Admin-specific screens (desktop)
├── (packer)/         # Packer-specific screens (tablet) 
├── auth/             # Authentication screens
└── _layout.tsx       # Root layout with auth checks

components/
├── common/           # Shared components
├── admin/            # Admin-specific components
└── packer/           # Packer-specific components

utils/
├── api/              # Supabase client and data functions
├── AuthContext.tsx   # Authentication context provider
└── PackerSessionContext.tsx # Packer session management
```

### Navigation Architecture
- Uses Expo Router's file-based routing
- Group folders `(admin)` and `(packer)` separate role-based navigation
- Root `_layout.tsx` handles authentication checks and role-based redirects
- Each group has its own `_layout.tsx` for role-specific navigation (tabs/drawers)

### Database Architecture
**Core Entities:**
- `profiles` → User data with role-based permissions
- `orders` → Client orders (central entity)
- `order_packages` → Individual equipment pieces within orders
- `order_package_materials` → Bill of materials for each package
- `attendance_logs` → Packer attendance tracking
- `audit_log` → Complete change tracking for accountability

**Key Relationships:**
- Orders contain multiple order_packages (1:many)
- Packages use materials via order_package_materials (many:many)
- Packers assigned to orders via order_teams (many:many)
- All changes tracked in audit_log for compliance

### Authentication & Authorization
- Supabase Auth with Row Level Security (RLS)
- Role-based access: director → admin → project_lead → sales → packer
- Username-based login for packers (mapped to email internally)
- Phone/OTP authentication support for simplified packer login

## Key Development Patterns

### Component Development
- Break UI into small, reusable components
- Use NativeWind classes exclusively for styling
- Place shared components in `components/common/`
- Role-specific components in `components/admin/` or `components/packer/`

### State Management
- Local state: `useState`
- Global auth state: `AuthContext`
- Packer workflow state: `PackerSessionContext`
- Database state: Direct Supabase queries (no additional state management)

### Data Operations
- All database interactions through `utils/api/supabase.ts`
- Comprehensive helper functions for common operations
- Error handling with user-friendly messages
- Audit logging for critical changes

### Security Considerations
- Rely on Supabase RLS policies for access control
- Never bypass RLS on client-side
- All sensitive operations trigger audit log entries
- Input validation both client and server-side

## Common Development Workflows

### Adding New Admin Features
1. Create screen in `app/(admin)/`
2. Add corresponding component in `components/admin/`
3. Add navigation link in admin `_layout.tsx`
4. Implement data operations in `utils/api/supabase.ts`
5. Add audit logging for sensitive operations

### Adding Packer Functionality
1. Create screen in `app/(packer)/`
2. Focus on touch-friendly, tablet-optimized UI
3. Minimize text input, prefer dropdowns/toggles
4. Use PackerSessionContext for workflow state
5. Test on tablet form factors

### Database Changes
1. Create migration SQL in `docs/` folder
2. Test in development Supabase project first
3. Use MCP `apply_migration` tool for deployment
4. Update TypeScript types if needed
5. Run `get_advisors` to check for security issues

### Material Calculation Engine
The app features intelligent material calculation based on:
- Equipment dimensions and packing type
- Optimized sheet cutting algorithms (e.g., 244x122cm plywood)
- Supplier pricing lookup for cost estimation
- Support for various packing types (4A, 4B, 4C, 1A)

## User Roles & Access Levels

**Director**: Full system access, can manage all users and roles
**Admin**: Full operational access, user management (except role changes)  
**Project Lead**: Order and team management, limited user actions
**Sales**: Client and order management, commercial operations
**Packer**: Task logging, package updates, attendance tracking (tablet interface)

## Database Development

### Key Functions to Know
- `get_available_packers()` - Returns packers available for assignment
- `assign_packers_to_order()` - Assigns team to order with JSON structure
- `get_user_email_by_username()` - Username lookup for packer login
- `packer_logged_attendance_today()` - Check attendance status

### RLS Policy Pattern
All tables use RLS policies that enforce role-based access. Policies typically:
- Allow directors/admins full access
- Restrict packers to their assigned orders
- Filter based on user's role and order assignments

### Audit Trail
Every critical operation logs to `audit_log`:
- Entity type and ID
- Old/new values (JSONB)
- User who made change
- Timestamp and action type
- Critical alerts flagged separately

## Platform-Specific Considerations

### Desktop (Admin) Features
- Complex tables and filtering
- Detailed forms and data entry
- Mouse/keyboard optimized interactions
- Full system administration

### Tablet (Packer) Features
- Touch-friendly large buttons
- Simplified workflows
- Minimal text input
- Clear visual feedback
- Portrait/landscape support

## Environment Configuration

Required environment variables in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_NAME=IPAC Operations App
EXPO_PUBLIC_APP_VERSION=1.0.0
```

## Important Notes

- This is a proprietary application for IPAC operations management
- Security is paramount - all operations must maintain audit trail
- The app replaces manual Excel-based processes with automation
- Material calculation engine is a core feature requiring careful testing
- Multi-platform support requires responsive design considerations

<citations>
<document>
<document_type>WARP_DOCUMENTATION</document_type>
<document_id>SUMMARY</document_id>
</document>
<document>
<document_type>WEB_PAGE</document_type>
<document_id>https://warp.dev</document_id>
</document>
</citations>
