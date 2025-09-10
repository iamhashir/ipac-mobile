import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../utils/AuthContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();

  const goHome = () => {
    router.replace('/');
  };

  const goToLogin = () => {
    router.replace('/auth/login');
  };

  const goToAdminHome = () => {
    router.replace('/(admin)/home');
  };

  return (
    <View className="flex-1 justify-center items-center bg-gray-50 p-6">
      <Text className="text-2xl font-bold text-gray-900 mb-4">
        Page Not Found
      </Text>
      <Text className="text-gray-600 mb-4 text-center">
        The page you're looking for doesn't exist.
      </Text>
      
      {/* Debug Information */}
      <View className="bg-white p-4 rounded-lg shadow-sm mb-6 w-full max-w-md">
        <Text className="text-sm font-semibold mb-2">Debug Info:</Text>
        <Text className="text-xs font-mono text-gray-600">
          Path: {pathname}\n
          User: {user ? user.email : 'Not logged in'}\n
          Profile: {profile ? profile.full_name : 'No profile'}\n
          Role: {profile?.roles?.name || 'No role'}\n
          Loading: {loading ? 'Yes' : 'No'}
        </Text>
      </View>

      {/* Navigation Options */}
      <View className="space-y-3 w-full max-w-xs">
        <TouchableOpacity 
          onPress={goHome}
          className="bg-blue-500 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold text-center">Go to Root</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={goToLogin}
          className="bg-green-500 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold text-center">Go to Login</Text>
        </TouchableOpacity>
        
        {profile?.roles?.name === 'admin' && (
          <TouchableOpacity 
            onPress={goToAdminHome}
            className="bg-purple-500 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-semibold text-center">Admin Home</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
