import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native';
import { SidebarProvider, SidebarInset } from '../../components/ui/sidebar';
const AdminSidebar = lazy(() => import('./components/AdminSidebar'));

export default function AdminLayout() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profileLoadTimedOut, setProfileLoadTimedOut] = useState(false);

  // If profile doesn't load within 10s, fail fast to login instead of spinning forever
  useEffect(() => {
    if (loading || !user || profile) return;
    const t = setTimeout(() => setProfileLoadTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [loading, user, profile]);

  // Handle redirects when auth state changes
  useEffect(() => {
    if (loading) return;

    // Only redirect to login if no user or profile load timed out
    if (!user || profileLoadTimedOut) {
      router.replace('/auth/login');
      return;
    }

    // If user present but profile not yet loaded, don't redirect; show loader below
    if (!profile) return;

    const userRole = profile.roles?.name;
    if (userRole !== 'admin' && userRole !== 'director' && userRole !== 'sales') {
      router.replace('/');
      return;
    }

    // Land on /home when on root admin routes
    if (pathname === '/(admin)' || pathname === '/(admin)/' || pathname === '/(admin)/dashboard') {
      router.replace('/(admin)/home');
    }
  }, [user, profile, loading, profileLoadTimedOut, pathname, router]);

  if (loading || (user && !profile && !profileLoadTimedOut)) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-600">Loading your profile...</Text>
        <Text className="mt-2 text-gray-400 text-xs">If this takes more than 10 seconds, you'll be redirected to login.</Text>
      </View>
    );
  }

  if (!user || profileLoadTimedOut) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Redirecting to login...</Text>
      </View>
    );
  }

  const userRole = profile.roles?.name;
  if (userRole !== 'admin' && userRole !== 'director' && userRole !== 'sales') {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Access denied. Redirecting...</Text>
      </View>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Suspense fallback={
        <View className="w-64 h-full bg-white border-r border-gray-200 items-center justify-center">
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      }>
        <AdminSidebar />
      </Suspense>
      <SidebarInset>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="home" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="orders" />
          <Stack.Screen name="users" />
          <Stack.Screen name="inventory" />
          <Stack.Screen name="inventory-new" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="components/AdminSidebar" options={{ presentation: 'transparentModal' }} />
        </Stack>
      </SidebarInset>
    </SidebarProvider>
  );
}
