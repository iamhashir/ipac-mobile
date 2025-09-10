import React, { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native';
import { SidebarProvider, SidebarInset } from '../../components/ui/sidebar';
import AdminSidebar from './components/AdminSidebar';

export default function AdminLayout() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Handle redirects when auth state changes
  useEffect(() => {
    if (loading) return;
    // Only redirect to login if no user
    if (!user) {
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
  }, [user, profile, loading, pathname, router]);

  if (loading || (user && !profile)) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-600">Loading your profile...</Text>
      </View>
    );
  }

  if (!user) {
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
      <AdminSidebar />
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
