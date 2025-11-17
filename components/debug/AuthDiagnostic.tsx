import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../utils/AuthContext';
import { useRouter } from 'expo-router';

export function AuthDiagnostic() {
  const { user, profile, loading, session, getUserRole } = useAuth() as {
    user: any;
    profile: any;
    loading: boolean;
    session: any;
    getUserRole: () => string;
  };
  const router = useRouter();

  const diagnosticInfo = {
    loading,
    user: user ? {
      id: user.id,
      email: user.email,
      emailConfirmed: user.email_confirmed_at ? 'Yes' : 'No',
    } : null,
    profile: profile ? {
      id: profile.id,
      fullName: profile.full_name,
      username: profile.username,
      role: profile.roles?.name,
      status: profile.status,
    } : null,
    session: session ? {
      accessToken: session.access_token ? 'Present' : 'Missing',
      refreshToken: session.refresh_token ? 'Present' : 'Missing',
      expiresAt: session.expires_at,
    } : null,
    userRole: getUserRole(),
  };

  const navigateToAdmin = () => {
    router.push('/(admin)/home');
  };

  const navigateToPacker = () => {
    router.push('/(packer)/dashboard');
  };

  return (
    <View className="p-4 bg-white rounded-lg shadow-sm m-4">
      <Text className="text-lg font-bold mb-4">🔍 Auth Diagnostic</Text>
      
      <ScrollView className="max-h-96">
        <Text className="font-mono text-xs">
          {JSON.stringify(diagnosticInfo, null, 2)}
        </Text>
      </ScrollView>

      <View className="mt-4 space-y-2">
        <TouchableOpacity
          onPress={navigateToAdmin}
          className="bg-blue-500 p-3 rounded-lg"
        >
          <Text className="text-white text-center font-medium">
            Test Admin Navigation
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={navigateToPacker}
          className="bg-green-500 p-3 rounded-lg"
        >
          <Text className="text-white text-center font-medium">
            Test Packer Navigation
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
