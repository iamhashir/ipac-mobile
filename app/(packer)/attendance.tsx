import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { db } from '../../utils/api/supabase';

interface PackerAttendance {
  id: string;
  full_name: string;
  username: string;
  status: 'present' | 'absent' | null;
  startTime: string | null;
}

interface Order {
  id: string;
  order_name: string;
  client_name: string;
}

export default function AttendanceScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [packers, setPackers] = useState<PackerAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Parse parameters
  const orderId = params.orderId as string;
  const packerIds = JSON.parse(params.packerIds as string) as string[];

  useEffect(() => {
    loadData();
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
      const { data: packersData, error: packersError } = await db.getPackersByIds(packerIds);
      if (packersError) {
        console.error('Error loading packers:', packersError);
        Alert.alert('Error', 'Failed to load packer details');
        return;
      }

      // Initialize attendance data
      const attendanceData = packersData.map(packer => ({
        ...packer,
        status: null,
        startTime: null
      }));
      setPackers(attendanceData);

    } catch (error) {
      console.error('Error in loadData:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = (packerId: string, status: 'present' | 'absent') => {
    setPackers(prev => prev.map(packer => {
      if (packer.id === packerId) {
        const newStatus = packer.status === status ? null : status;
        return {
          ...packer,
          status: newStatus,
          startTime: newStatus === 'present' ? getCurrentTime() : null
        };
      }
      return packer;
    }));
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getCurrentDateTime = () => {
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

  const handleSubmitAttendance = async () => {
    // Check if all packers have attendance marked
    const unmarkedPackers = packers.filter(packer => packer.status === null);
    if (unmarkedPackers.length > 0) {
      Alert.alert(
        'Incomplete Attendance',
        `Please mark attendance for: ${unmarkedPackers.map(p => p.full_name).join(', ')}`
      );
      return;
    }

    setSubmitting(true);
    try {
      // Submit attendance for each packer
      for (const packer of packers) {
        const { error } = await db.logAttendance(
          orderId,
          packer.id,
          'morning', // Default shift period
          packer.status!,
          packer.startTime
        );

        if (error) {
          console.error(`Error logging attendance for ${packer.full_name}:`, error);
          Alert.alert('Error', `Failed to log attendance for ${packer.full_name}`);
          return;
        }
      }

      Alert.alert(
        'Success',
        'Attendance has been logged successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(packer)/dashboard')
          }
        ]
      );

    } catch (error) {
      console.error('Error submitting attendance:', error);
      Alert.alert('Error', 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      Alert.alert('Error', 'Failed to sign out');
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-500 px-4 py-3">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-xl font-bold">
              Attendance Registration
            </Text>
            <Text className="text-primary-100 text-sm">
              {order?.order_name} - {order?.client_name}
            </Text>
          </View>
          <View className="flex-row items-center space-x-4">
            <Text className="text-white text-sm font-medium">
              {getCurrentDateTime()}
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
        <View className="bg-white rounded-lg shadow-sm flex-1">
          <View className="bg-primary-500 px-4 py-3 rounded-t-lg">
            <Text className="text-white font-semibold text-base">
              📋 Mark Attendance
            </Text>
          </View>

          {/* Instructions */}
          <View className="p-4 bg-blue-50 border-b border-blue-100">
            <Text className="text-blue-800 text-sm font-medium mb-1">
              Instructions:
            </Text>
            <Text className="text-blue-700 text-sm">
              Mark each team member as Present or Absent for today's shift
            </Text>
          </View>

          {/* Attendance List */}
          <ScrollView className="flex-1 p-4">
            {packers.map((packer, index) => (
              <View
                key={packer.id}
                className={`mb-4 p-4 rounded-lg border ${
                  packer.status === 'present'
                    ? 'bg-green-50 border-green-200'
                    : packer.status === 'absent'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View>
                    <Text className="text-gray-900 font-semibold text-lg">
                      {packer.full_name}
                    </Text>
                    <Text className="text-gray-600 text-sm">
                      @{packer.username}
                    </Text>
                  </View>
                  {packer.status === 'present' && packer.startTime && (
                    <View className="bg-green-100 px-2 py-1 rounded">
                      <Text className="text-green-800 text-xs font-medium">
                        Start: {packer.startTime}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Attendance Buttons */}
                <View className="flex-row space-x-3">
                  <TouchableOpacity
                    onPress={() => toggleAttendance(packer.id, 'present')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 flex-row items-center justify-center ${
                      packer.status === 'present'
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-green-300'
                    }`}
                  >
                    <View className={`w-5 h-5 rounded-full mr-2 ${
                      packer.status === 'present' ? 'bg-white' : 'bg-gray-300'
                    }`} />
                    <Text className={`font-medium ${
                      packer.status === 'present' ? 'text-white' : 'text-green-700'
                    }`}>
                      Present
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => toggleAttendance(packer.id, 'absent')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 flex-row items-center justify-center ${
                      packer.status === 'absent'
                        ? 'bg-red-500 border-red-500'
                        : 'bg-white border-red-300'
                    }`}
                  >
                    <View className={`w-5 h-5 rounded-full mr-2 ${
                      packer.status === 'absent' ? 'bg-white' : 'bg-gray-300'
                    }`} />
                    <Text className={`font-medium ${
                      packer.status === 'absent' ? 'text-white' : 'text-red-700'
                    }`}>
                      Absent
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Summary */}
          <View className="p-4 bg-gray-50 border-t border-gray-200">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-700 font-medium">Summary:</Text>
              <View className="flex-row space-x-4">
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-green-500 rounded-full mr-1" />
                  <Text className="text-sm text-gray-600">
                    Present: {packers.filter(p => p.status === 'present').length}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-red-500 rounded-full mr-1" />
                  <Text className="text-sm text-gray-600">
                    Absent: {packers.filter(p => p.status === 'absent').length}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 bg-gray-400 rounded-full mr-1" />
                  <Text className="text-sm text-gray-600">
                    Pending: {packers.filter(p => p.status === null).length}
                  </Text>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmitAttendance}
              disabled={submitting || packers.some(p => p.status === null)}
              className={`py-3 px-6 rounded-lg ${
                submitting || packers.some(p => p.status === null)
                  ? 'bg-gray-300'
                  : 'bg-primary-500'
              }`}
            >
              <Text className={`text-center font-semibold ${
                submitting || packers.some(p => p.status === null)
                  ? 'text-gray-500'
                  : 'text-white'
              }`}>
                {submitting ? 'Submitting...' : 'Submit Attendance'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
