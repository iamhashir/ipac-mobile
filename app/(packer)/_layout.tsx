
import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

export default function PackerLayout() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth() as any;
  const router = useRouter();
  const [profileWaitTooLong, setProfileWaitTooLong] = useState(false);

  // Redirect logic
  useEffect(() => {
    if (loading) return;

    if (!user) {
      console.log('🔒 Packer layout: No user, redirecting to login');
      router.replace('/auth/login');
      return;
    }

    if (!profile) return;

    const userRole = profile.roles?.name;
    if (userRole !== 'packer') {
      console.log('🔒 Packer layout: Not a packer, redirecting');
      router.replace('/');
      return;
    }

    console.log('✅ Packer layout: Access granted for', userRole);
  }, [user, profile, loading]);

  // Profile loading watchdog to avoid perceived "freeze"
  useEffect(() => {
    const waiting = loading || (user && !profile);
    if (!waiting) {
      setProfileWaitTooLong(false);
      return;
    }
    setProfileWaitTooLong(false);
    const t = setTimeout(() => setProfileWaitTooLong(true), 8000); // 8s
    return () => clearTimeout(t);
  }, [loading, user, profile]);

  const isWaiting = loading || (user && !profile);
  if (isWaiting) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 px-6">
        {!profileWaitTooLong ? (
          <>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-4 text-gray-600">Checking permissions...</Text>
          </>
        ) : (
          <>
            <Text className="text-gray-800 text-base font-semibold mb-2">Still loading your profile...</Text>
            <Text className="text-gray-600 text-sm mb-4 text-center">This is taking longer than expected. You can retry loading your profile or sign out.</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="px-4 py-2 rounded-lg bg-blue-600"
                onPress={async () => { await refreshProfile?.(); }}
              >
                <Text className="text-white font-medium">Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-4 py-2 rounded-lg bg-gray-200"
                onPress={async () => { await signOut?.(); router.replace('/auth/login'); }}
              >
                <Text className="text-gray-800 font-medium">Sign out</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
  if (userRole !== 'packer') {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Access denied. Redirecting...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="attendance" />
  <Stack.Screen name="packing-list" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
