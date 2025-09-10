import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../utils/AuthContext';

export default function Index() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('🏠 Index: Loading timeout reached, forcing redirect to login');
        setLoadingTimeout(true);
        router.replace('/auth/login');
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading, router]);

  useEffect(() => {
    console.log('🏠 Index: Auth state changed', { 
      loading, 
      user: user?.email, 
      profile: profile?.full_name,
      role: profile?.roles?.name,
      loadingTimeout 
    });
    
    // If we hit the loading timeout, don't process further
    if (loadingTimeout) {
      return;
    }
    
    // Don't do anything while still loading
    if (loading) {
      console.log('🏠 Index: Still loading auth state...');
      return;
    }
    
    // No user - go to login
    if (!user) {
      console.log('🏠 Index: No user, redirecting to login');
      router.replace('/auth/login');
      return;
    }
    
    // User exists but no profile - could be profile loading error
    // Give it a chance but if profile is null and not loading, go to login
    if (!profile) {
      console.log('🏠 Index: User exists but no profile loaded');
      console.log('🏠 Index: This could indicate RLS policy issues or missing profile data');
      // Instead of immediately redirecting, let's try to handle this case
      // by redirecting to login where they can try again
      router.replace('/auth/login');
      return;
    }
    
    // User and profile exist - route based on role
    const userRole = profile.roles?.name;
    console.log('🏠 Index: User has profile, role:', userRole);
    
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
  }, [user, profile, loading, router, loadingTimeout]);

  // Show loading screen while checking authentication
  return (
    <View className="flex-1 justify-center items-center bg-gray-50">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="mt-4 text-gray-600 text-lg">Loading IPAC Operations...</Text>
    </View>
  );
}
