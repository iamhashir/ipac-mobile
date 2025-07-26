import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../utils/AuthContext';

export default function Index() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // No user logged in, go to auth
        router.replace('/auth/login');
      } else if (profile) {
        // User is logged in and profile is loaded
        const userRole = profile.roles?.name;
        
        if (userRole === 'admin' || userRole === 'director' || userRole === 'project_lead' || userRole === 'sales') {
          // Admin users go to admin dashboard
          router.replace('/(admin)/dashboard');
        } else if (userRole === 'packer') {
          // Packer users go to packer dashboard
          router.replace('/(packer)/dashboard');
        } else {
          // Unknown role, go to auth
          router.replace('/auth/login');
        }
      }
    }
  }, [user, profile, loading]);

  // Show loading screen while checking authentication
  return (
    <View className="flex-1 justify-center items-center bg-gray-50">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="mt-4 text-gray-600 text-lg">Loading IPAC Operations...</Text>
    </View>
  );
}
