import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../utils/AuthContext';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-500 px-4 py-3">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-xl font-bold">
              IPAC Admin Dashboard
            </Text>
            <Text className="text-primary-100 text-sm">
              Welcome, {profile?.full_name}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={handleSignOut}
            className="bg-primary-600 px-3 py-1 rounded"
          >
            <Text className="text-white text-sm">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 p-4">
        <View className="bg-white rounded-lg shadow-sm p-6">
          <Text className="text-2xl font-bold text-gray-900 mb-2">
            Admin Dashboard
          </Text>
          <Text className="text-gray-600 mb-6">
            Manage orders, users, and oversee all operations
          </Text>
          
          <View className="space-y-3">
            <TouchableOpacity className="bg-primary-500 p-4 rounded-lg">
              <Text className="text-white font-semibold text-center">
                📋 Order Management
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="bg-green-500 p-4 rounded-lg">
              <Text className="text-white font-semibold text-center">
                👥 User Management
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="bg-blue-500 p-4 rounded-lg">
              <Text className="text-white font-semibold text-center">
                📊 Reports & Analytics
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="bg-purple-500 p-4 rounded-lg">
              <Text className="text-white font-semibold text-center">
                🔧 System Settings
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
