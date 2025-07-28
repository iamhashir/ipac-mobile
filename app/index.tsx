import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../utils/AuthContext';

export default function Index() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('🏠 Index: Auth state changed', { 
      loading, 
      user: user?.email, 
      profile: profile?.full_name,
      role: profile?.roles?.name 
    });
    
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
    
    // User exists but no profile - redirect to login (profile should load quickly or there's an error)
    if (!profile) {
      console.log('🏠 Index: User exists but no profile loaded, redirecting to login');
      router.replace('/auth/login');
      return;
    }
    
    // User and profile exist - route based on role
    const userRole = profile.roles?.name;
    console.log('🏠 Index: User has profile, role:', userRole);
    
    if (userRole === 'admin' || userRole === 'director' || userRole === 'sales') {
      console.log('🏠 Index: Redirecting to admin dashboard');
      router.replace('/(admin)/dashboard');
    } else if (userRole === 'packer') {
      console.log('🏠 Index: Redirecting to packer dashboard');
      router.replace('/(packer)/dashboard');
    } else {
      console.log('🏠 Index: Unknown role, redirecting to login');
      router.replace('/auth/login');
    }
  }, [user, profile, loading, router]);

  // Show loading screen while checking authentication
  return (
    <View className="flex-1 justify-center items-center bg-gray-50">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="mt-4 text-gray-600 text-lg">Loading IPAC Operations...</Text>
    </View>
  );
}
