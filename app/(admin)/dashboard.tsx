import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    // Immediately redirect to home
    router.replace('/(admin)/home');
  }, [router]);

  return (
    <View className="flex-1 justify-center items-center bg-gray-50">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="mt-4 text-gray-600">Loading dashboard...</Text>
    </View>
  );
}
