import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { db } from '../../utils/api/supabase';
import { ArrowLeft } from 'lucide-react-native';
import { NavigationButtons } from '../../components/NavigationButtons';

interface Order {
  id: string;
  order_name: string;
  client_name: string;
}

interface Packer {
  id: string;
  full_name: string;
  packer_id: string;
}

export default function PackagingDossier() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [packers, setPackers] = useState<Packer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAfternoon, setIsAfternoon] = useState(false);

  useEffect(() => {
    loadData();
    checkTime();
  }, []);

  const loadData = async () => {
    try {
      // Load order details
      const { data: orderData, error: orderError } = await db.getOrderById(orderId);
      if (orderError) {
        console.error('Error loading order:', orderError);
        Alert.alert('Error', 'Failed to load order details');
        return;
      }
      setOrder(orderData);

      // Load packer details
      const { data: packersData, error: packersError } = await db.getOrderPackers(orderId);
      if (packersError) {
        console.error('Error loading packers:', packersError);
        Alert.alert('Error', 'Failed to load packer details');
        return;
      }
      setPackers(packersData || []);

    } catch (error) {
      console.error('Error in loadData:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkTime = () => {
    const now = new Date();
    const hour = now.getHours();
    setIsAfternoon(hour >= 12);
  };

  const getCurrentShift = (): 'morning' | 'afternoon' => {
    return isAfternoon ? 'afternoon' : 'morning';
  };

  const handleRefresh = () => {
    // Refresh data after end work is marked
    loadData();
  };

  const handleBack = () => {
    router.back();
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        Alert.alert('Error', 'Failed to sign out');
      } else {
        router.replace('/auth/login');
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      Alert.alert('Error', 'An unexpected error occurred during sign out');
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-lg text-gray-600">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-blue-100">
      {/* Header */}
      <View className="flex-row justify-between items-center p-4">
        <TouchableOpacity 
          onPress={handleBack}
          className="flex-row items-center"
        >
          <ArrowLeft size={24} color="#000" />
          <Text className="ml-2 text-lg font-semibold">Back</Text>
        </TouchableOpacity>
        
        <Text className="text-2xl font-semibold">Packaging Dossier</Text>
        
        <TouchableOpacity 
          onPress={handleSignOut}
          className="bg-blue-500 px-3 py-1 rounded"
        >
          <Text className="text-white text-sm">Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Buttons */}
      <NavigationButtons currentScreen="packaging-dossier" />

      {/* Main Content */}
      <ScrollView className="flex-1 p-4">
        {order && (
          <View className="bg-white rounded-lg shadow-md p-4 mb-4">
            <Text className="text-xl font-bold mb-2">{order.order_name}</Text>
            <Text className="text-gray-600 mb-2">Client: {order.client_name}</Text>
            <Text className="text-gray-600">Current Shift: {getCurrentShift()}</Text>
          </View>
        )}
        
        {/* Packaging Details - Future Implementation */}
        <View className="bg-white rounded-lg shadow-md p-4 mb-4">
          <Text className="text-lg font-semibold mb-2">Packaging Information</Text>
          <Text className="text-gray-700 mb-2">
            Detailed packaging specifications and requirements will be displayed here.
          </Text>
          <Text className="text-gray-700">
            This includes materials, dimensions, packing instructions, and quality requirements.
          </Text>
        </View>

        {/* Note: End work functionality has been moved to the attendance screen */}
        <View className="bg-white rounded-lg shadow-md p-4 mb-4">
          <Text className="text-lg font-semibold mb-2">Work Management</Text>
          <Text className="text-gray-700">
            To mark the end of your work, please return to the attendance screen using the back button.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

