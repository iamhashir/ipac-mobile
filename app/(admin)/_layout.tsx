import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native';

export default function AdminLayout() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        console.log('🔒 Admin layout: No user, redirecting to login');
        router.replace('/auth/login');
        return;
      }
      
      if (!profile) {
        console.log('🔒 Admin layout: No profile, redirecting to login');
        router.replace('/auth/login');
        return;
      }
      
      const userRole = profile.roles?.name;
      if (userRole !== 'admin' && userRole !== 'director' && userRole !== 'sales') {
        console.log('🔒 Admin layout: Insufficient permissions, redirecting');
        router.replace('/');
        return;
      }
      
      console.log('✅ Admin layout: Access granted for', userRole);
    }
  }, [user, profile, loading]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-600">Checking permissions...</Text>
      </View>
    );
  }

  if (!user || !profile) {
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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
    </Stack>
  );
}
