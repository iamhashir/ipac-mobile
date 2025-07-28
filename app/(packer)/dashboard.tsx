import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { db } from '../../utils/api/supabase';

interface Order {
  id: string;
  order_name: string;
  description: string;
  client_name: string;
}

interface Packer {
  id: string;
  full_name: string;
  username: string;
  packer_status: string;
}

export default function PackerDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [availablePackers, setAvailablePackers] = useState<Packer[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedPackers, setSelectedPackers] = useState<string[]>([]);
  const [projectLeads, setProjectLeads] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load available orders
      const { data: orders, error: ordersError } = await db.getAvailableOrders();
      if (ordersError) {
        console.error('Error loading orders:', ordersError);
      } else {
        setAvailableOrders(orders || []);
      }

      // Load available packers
      const { data: packers, error: packersError } = await db.getAvailablePackers();
      if (packersError) {
        console.error('Error loading packers:', packersError);
      } else {
        setAvailablePackers(packers || []);
      }
    } catch (error) {
      console.error('Error in loadData:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePackerSelection = (packerId: string) => {
    setSelectedPackers(prev => 
      prev.includes(packerId) 
        ? prev.filter(id => id !== packerId)
        : [...prev, packerId]
    );
  };

  const toggleProjectLead = (packerId: string) => {
    setProjectLeads(prev => 
      prev.includes(packerId) 
        ? prev.filter(id => id !== packerId)
        : [...prev, packerId]
    );
  };

  const handleNext = async () => {
    if (!selectedOrder) {
      Alert.alert('Error', 'Please select a project');
      return;
    }

    if (selectedPackers.length === 0) {
      Alert.alert('Error', 'Please select at least one packer');
      return;
    }

    try {
      // Assign packers to order
      const { error } = await db.assignPackersToOrder(selectedOrder, selectedPackers);
      
      if (error) {
        Alert.alert('Error', 'Failed to assign team to project');
        return;
      }

      // Navigate to attendance screen
      router.push({
        pathname: '/(packer)/attendance',
        params: { 
          orderId: selectedOrder,
          packerIds: JSON.stringify(selectedPackers)
        }
      });
    } catch (error) {
      console.error('Error assigning team:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-500 px-4 py-3">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-xl font-bold">
              Files to be processed
            </Text>
            <Text className="text-primary-100 text-sm">
              Welcome, {profile?.full_name}
            </Text>
          </View>
          <View className="flex-row items-center space-x-4">
            <Text className="text-white text-sm font-medium">
              {getCurrentTime()}
            </Text>
            <TouchableOpacity 
              onPress={handleSignOut}
              className="bg-primary-600 px-3 py-1 rounded"
            >
              <Text className="text-white text-sm">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 p-4">
        <View className="flex-row flex-1 space-x-4">
          {/* Left Column - Select File */}
          <View className="flex-1 bg-white rounded-lg shadow-sm">
            <View className="bg-primary-500 px-4 py-3 rounded-t-lg">
              <Text className="text-white font-semibold text-base">
                📁 Select File
              </Text>
            </View>
            
            <ScrollView className="flex-1 p-4">
              {availableOrders.length === 0 ? (
                <Text className="text-gray-500 text-center py-8">
                  No projects available
                </Text>
              ) : (
                availableOrders.map((order) => (
                  <TouchableOpacity
                    key={order.id}
                    onPress={() => setSelectedOrder(order.id)}
                    className={`mb-2 p-3 rounded-lg border ${
                      selectedOrder === order.id
                        ? 'bg-primary-50 border-primary-500'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <View className="flex-row items-center">
                      <View className={`w-4 h-4 rounded mr-3 ${
                        selectedOrder === order.id ? 'bg-primary-500' : 'bg-gray-300'
                      }`} />
                      <View className="flex-1">
                        <Text className={`font-medium ${
                          selectedOrder === order.id ? 'text-primary-700' : 'text-gray-900'
                        }`}>
                          📄 {order.order_name}
                        </Text>
                        <Text className="text-gray-600 text-sm mt-1">
                          {order.client_name}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>

          {/* Right Column - Select Packers */}
          <View className="flex-1 bg-white rounded-lg shadow-sm">
            <View className="bg-primary-500 px-4 py-3 rounded-t-lg">
              <Text className="text-white font-semibold text-base">
                Select Packers
              </Text>
            </View>
            
            <View className="p-4">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-gray-700 font-medium">Packer Name</Text>
                <Text className="text-gray-700 font-medium">Project Lead</Text>
              </View>
            </View>

            <ScrollView className="flex-1 px-4">
              {availablePackers.length === 0 ? (
                <Text className="text-gray-500 text-center py-8">
                  No packers available
                </Text>
              ) : (
                availablePackers.map((packer) => (
                  <View
                    key={packer.id}
                    className="flex-row items-center justify-between py-3 border-b border-gray-100"
                  >
                    <TouchableOpacity 
                      onPress={() => togglePackerSelection(packer.id)}
                      className="flex-row items-center flex-1"
                      activeOpacity={0.7}
                    >
                      <View className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${
                        selectedPackers.includes(packer.id)
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedPackers.includes(packer.id) && (
                          <Text className="text-white text-xs">✓</Text>
                        )}
                      </View>
                      <Text className="text-gray-800 font-medium">
                        {packer.full_name}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={() => toggleProjectLead(packer.id)}
                      activeOpacity={0.7}
                    >
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        projectLeads.includes(packer.id)
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-300'
                      }`}>
                        {projectLeads.includes(packer.id) && (
                          <Text className="text-white text-xs">✓</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>

        {/* Next Button */}
        <View className="mt-4 flex-row justify-end">
          <TouchableOpacity
            onPress={handleNext}
            disabled={!selectedOrder || selectedPackers.length === 0}
            className={`px-6 py-3 rounded-lg ${
              selectedOrder && selectedPackers.length > 0
                ? 'bg-primary-500'
                : 'bg-gray-300'
            }`}
          >
            <Text className={`font-semibold ${
              selectedOrder && selectedPackers.length > 0
                ? 'text-white'
                : 'text-gray-500'
            }`}>
              ▷ Next
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
