import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../../utils/AuthContext';
import { 
  Home, 
  Users, 
  ShoppingCart, 
  Package,
  BarChart3, 
  Settings, 
  LogOut 
} from 'lucide-react-native';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '../../../components/ui/sidebar';
import { cn } from '../../../utils/cn';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  route: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'home',
    title: 'Home',
    icon: Home,
    route: '/(admin)/home'
  },
  {
    id: 'orders',
    title: 'Order Management',
    icon: ShoppingCart,
    route: '/(admin)/orders'
  },
  {
    id: 'users',
    title: 'Staff Management',
    icon: Users,
    route: '/(admin)/users'
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    icon: Package,
    route: '/(admin)/inventory'
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    icon: BarChart3,
    route: '/(admin)/reports'
  },
  {
    id: 'settings',
    title: 'System Settings',
    icon: Settings,
    route: '/(admin)/settings'
  }
];

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <Sidebar className="border-r border-gray-200">
      {/* Header */}
      <SidebarHeader>
        <View>
          <Text className="text-xl font-bold text-gray-900">IPAC Admin</Text>
          <Text className="text-sm text-gray-600 mt-1">
            {profile?.full_name}
          </Text>
          <Text className="text-xs text-gray-500">
            {profile?.roles?.name}
          </Text>
        </View>
      </SidebarHeader>

      {/* Menu Items */}
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.route;
            
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={isActive}
                  onPress={() => handleNavigation(item.route)}
                >
                  <Icon 
                    size={20} 
                    color={isActive ? '#3b82f6' : '#6b7280'} 
                  />
                  <Text className={cn(
                    "ml-3 font-medium",
                    isActive ? 'text-primary-600' : 'text-gray-700'
                  )}>
                    {item.title}
                  </Text>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <TouchableOpacity
          onPress={handleSignOut}
          className="flex-row items-center px-4 py-3 rounded-lg"
        >
          <LogOut size={20} color="#dc2626" />
          <Text className="ml-3 text-red-600 font-medium">Sign Out</Text>
        </TouchableOpacity>
      </SidebarFooter>
    </Sidebar>
  );
}
