+# IPAC Operations App

A comprehensive operational management application for industrial packaging and preservation services, built with React Native and Expo.

## Overview

This application digitizes and streamlines the entire end-to-end workflow of industrial packaging operations, from initial client orders and material procurement to detailed production tracking, team management, precise cost analysis, and comprehensive system auditing.

## Key Features

- **Centralized Order & Project Management**: Single source of truth for all client orders and production packages
- **Role-Based Access Control**: Granular user permissions with roles (director, admin, packer, project_lead, sales)
- **Real-time Production Tracking**: Live insights into package progress and workforce productivity
- **Material Management**: Dynamic catalog with suppliers, pricing, and consumption tracking  
- **Cost Analysis**: Automated calculations for materials, labor, and transportation costs
- **Audit Trail**: Comprehensive logging of all system changes and user actions
- **Multi-Platform Support**: 
  - Desktop app for Admin users (full functionality)
  - Tablet app for Packer users (simplified interface)

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API / Zustand
- **Database**: PostgreSQL with Row Level Security (RLS)

## Project Structure

```
app/
├── (admin)/          # Admin-specific screens (desktop)
│   ├── _layout.js    # Admin navigation layout
│   ├── dashboard.js  # Admin dashboard
│   └── orders/       # Order management screens
├── (packer)/         # Packer-specific screens (tablet)
│   ├── _layout.js    # Packer navigation layout
│   ├── dashboard.js  # Packer dashboard
│   └── my-orders.js  # Assigned orders
├── auth/             # Authentication screens
└── _layout.js        # Root layout with auth checks

components/
├── common/           # Shared components
├── admin/            # Admin-specific components
└── packer/           # Packer-specific components

utils/
├── api/              # Supabase client and data functions
├── hooks/            # Custom React hooks
└── constants/        # Global constants
```

## Database Schema

The application uses a comprehensive PostgreSQL schema with the following main entities:

- **Users & Access Control**: `roles`, `profiles` with granular permissions
- **Core Operations**: `orders`, `order_packages`, `order_teams`
- **Materials Management**: `materials`, `material_variants`, `suppliers`, `supplier_pricing`
- **Production Tracking**: `task_logs`, `attendance_logs`, `order_package_materials`
- **Auditing**: `audit_log` for comprehensive change tracking

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Expo CLI
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aikram42/ipac-operations-app.git
   cd ipac-operations-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Add your Supabase URL and API keys
   ```

4. Set up the database:
   - Set up your Supabase project with the required database schema
   - Configure Row Level Security (RLS) policies as needed

5. Start the development server:
   ```bash
   npx expo start
   ```

## Development Guidelines

- **Component-Based Architecture**: Break UI into small, reusable components
- **File-Based Routing**: Use Expo Router's directory structure for navigation
- **NativeWind Styling**: Apply Tailwind CSS classes directly in JSX
- **Type Safety**: Use TypeScript for better development experience
- **Security First**: Rely on Supabase RLS policies for data access control

## User Roles & Permissions

- **Director**: Full system access, can manage all users and roles
- **Admin**: Full operational access, user management (except role changes)
- **Project Lead**: Order and team management, limited user actions
- **Sales**: Client and order management, commercial operations
- **Packer**: Task logging, package updates, attendance tracking (tablet interface)

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes following the project guidelines
3. Test thoroughly on both admin (desktop) and packer (tablet) interfaces
4. Submit a pull request with a clear description of changes

## License

This project is proprietary software for IPAC operations management.

## Support

For technical support or questions, please contact the development team.
