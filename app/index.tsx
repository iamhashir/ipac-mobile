import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../utils/AuthContext';

export default function Index() {
  const { user, profile, loading, profileLoadingTimeout } = useAuth();
  const router = useRouter();
  const [didNavigate, setDidNavigate] = useState(false);

  // Removed aggressive 10s redirect to avoid racing with auth
  // We'll rely on profileLoadingTimeout from AuthContext for fallback.

  useEffect(() => {
    if (didNavigate) return;

    console.log('🏠 Index: Auth state changed', { 
      loading, 
      user: user?.email, 
      profile: profile?.full_name,
      role: profile?.roles?.name,
      profileLoadingTimeout
    });
    
    // Still loading auth or waiting on profile -> do nothing
    if (loading) {
      console.log('🏠 Index: Still loading auth state...');
      return;
    }

    // No user -> login
    if (!user) {
      console.log('🏠 Index: No user, redirecting to login');
      setDidNavigate(true);
      router.replace('/auth/login');
      return;
    }

    // If profile loaded -> route by role
    if (profile) {
      const userRole = profile.roles?.name;
      console.log('🏠 Index: User has profile, role:', userRole);
      setDidNavigate(true);
      if (userRole === 'admin' || userRole === 'director' || userRole === 'sales') {
        console.log('🏠 Index: Redirecting to admin home');
        router.replace('/(admin)/home');
      } else if (userRole === 'packer') {
        console.log('🏠 Index: Redirecting to packer dashboard');
        router.replace('/(packer)/dashboard');
      } else {
        console.log('🏠 Index: Unknown role, redirecting to login');
        router.replace('/auth/login');
      }
      return;
    }

    // Fallback: user exists but profile didn't load within timeout
    if (profileLoadingTimeout) {
      console.log('🏠 Index: Profile timeout detected, using metadata fallback');
      const metadataRole = user?.user_metadata?.role || user?.app_metadata?.role;
      setDidNavigate(true);
      if (metadataRole === 'packer') {
        router.replace('/(packer)/dashboard');
      } else {
        router.replace('/(admin)/home');
      }
    }
  }, [user, profile, loading, router, profileLoadingTimeout, didNavigate]);

  // Show loading screen while checking authentication
  return (
    <View className="flex-1 justify-center items-center bg-gray-50">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="mt-4 text-gray-600 text-lg">Loading IPAC Operations...</Text>
    </View>
  );
}
