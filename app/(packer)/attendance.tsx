import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { db } from '../../utils/api/supabase';
import { ProjectHeader } from '../../components/packer/attendance/ProjectHeader';
import { AttendanceTable } from '../../components/packer/attendance/AttendanceTable';
import { Clock } from '../../components/packer/attendance/Clock';
import { ArrowLeft } from 'lucide-react-native';

// Types based on the reference
interface AttendancePeriod {
  present: boolean | null;
  startTime: string | null;
  endTime: string | null;
  manualStart: boolean;
  manualEnd: boolean;
}

interface AttendanceEntry {
  morning: AttendancePeriod;
  afternoon: AttendancePeriod;
}

interface AttendanceRecord {
  [name: string]: AttendanceEntry;
}

interface Order {
  id: string;
  order_name: string;
  client_name: string;
  project_lead_name: string;
}

type TimePeriod = 'morning' | 'afternoon';

export default function AttendanceScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // State management based on reference
  const [order, setOrder] = useState<Order | null>(null);
  const [packers, setPackers] = useState<string[]>([]);
  const [packersData, setPackersData] = useState<any[]>([]);
  const [projectLead, setProjectLead] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [toolboxCompleted, setToolboxCompleted] = useState(false);
  const [isAfternoon, setIsAfternoon] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Parse parameters
  const orderId = params.orderId as string;

  useEffect(() => {
    loadData();
    checkAfternoonTime();
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
      setProjectLead(orderData.project_lead_name);

      // Load packer details
      const { data: packersResponse, error: packersError } = await db.getOrderPackers(orderId);
      if (packersError) {
        console.error('Error loading packers:', packersError);
        Alert.alert('Error', 'Failed to load packer details');
        return;
      }

      // Store packers data and names
      setPackersData(packersResponse);
      const packerNames = packersResponse.map(packer => packer.full_name);
      setPackers(packerNames);

      // Initialize attendance records
      const initialAttendance: AttendanceRecord = {};
      packerNames.forEach(name => {
        initialAttendance[name] = {
          morning: {
            present: null,
            startTime: null,
            endTime: null,
            manualStart: false,
            manualEnd: false
          },
          afternoon: {
            present: null,
            startTime: null,
            endTime: null,
            manualStart: false,
            manualEnd: false
          }
        };
      });
      setAttendance(initialAttendance);

    } catch (error) {
      console.error('Error in loadData:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkAfternoonTime = () => {
    const now = new Date();
    const hour = now.getHours();
    setIsAfternoon(hour >= 12);
  };

  const togglePresence = (name: string, period: TimePeriod, isPresent: boolean) => {
    setAttendance(prevAttendance => ({
      ...prevAttendance,
      [name]: {
        ...prevAttendance[name],
        [period]: {
          ...prevAttendance[name][period],
          present: isPresent,
        }
      }
    }));
  };

  const toggleStartEndTime = (name: string, period: TimePeriod, timeType: 'start' | 'end') => {
    const newTime = getCurrentTime();
    setAttendance(prevAttendance => ({
      ...prevAttendance,
      [name]: {
        ...prevAttendance[name],
        [period]: {
          ...prevAttendance[name][period],
          [timeType === 'start' ? 'startTime' : 'endTime']: newTime,
        }
      }
    }));
  };

  const bulkTogglePresence = (period: TimePeriod, isPresent: boolean) => {
    const updatedAttendance = { ...attendance };
    packers.forEach(name => {
      updatedAttendance[name][period].present = isPresent;
    });
    setAttendance(updatedAttendance);
  };

  const bulkToggleTime = (period: TimePeriod, timeType: 'start' | 'end') => {
    const newTime = getCurrentTime();
    const updatedAttendance = { ...attendance };
    packers.forEach(name => {
      if (updatedAttendance[name][period].present) {
        updatedAttendance[name][period][timeType === 'start' ? 'startTime' : 'endTime'] = newTime;
      }
    });
    setAttendance(updatedAttendance);
  };

  const clearEndTime = (name: string, period: TimePeriod) => {
    setAttendance(prevAttendance => ({
      ...prevAttendance,
      [name]: {
        ...prevAttendance[name],
        [period]: {
          ...prevAttendance[name][period],
          endTime: null,
        }
      }
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


  const saveAttendance = async () => {
    if (!order || packersData.length === 0) {
      Alert.alert('Error', 'Missing order or packer data');
      return false;
    }

    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendancePromises = [];

      // Create attendance records for each packer and period
      for (const packerName of packers) {
        const packerData = packersData.find(p => p.full_name === packerName);
        if (!packerData) continue;

        const packerAttendance = attendance[packerName];
        if (!packerAttendance) continue;

        // Save morning attendance if present
        if (packerAttendance.morning.present === true) {
          const morningStartTime = packerAttendance.morning.startTime 
            ? new Date(`${today} ${packerAttendance.morning.startTime}`).toISOString()
            : null;
          const morningEndTime = packerAttendance.morning.endTime 
            ? new Date(`${today} ${packerAttendance.morning.endTime}`).toISOString()
            : null;

          attendancePromises.push(
            db.logAttendance(
              orderId,
              packerData.packer_id || packerData.id,
              'morning',
              'present',
              morningStartTime,
              morningEndTime,
              toolboxCompleted,
              true // is_project_start
            )
          );
        }

        // Save afternoon attendance if present
        if (packerAttendance.afternoon.present === true) {
          const afternoonStartTime = packerAttendance.afternoon.startTime 
            ? new Date(`${today} ${packerAttendance.afternoon.startTime}`).toISOString()
            : null;
          const afternoonEndTime = packerAttendance.afternoon.endTime 
            ? new Date(`${today} ${packerAttendance.afternoon.endTime}`).toISOString()
            : null;

          attendancePromises.push(
            db.logAttendance(
              orderId,
              packerData.packer_id || packerData.id,
              'afternoon',
              'present',
              afternoonStartTime,
              afternoonEndTime,
              toolboxCompleted,
              false // is_project_start
            )
          );
        }
      }

      // Execute all attendance logging promises
      const results = await Promise.all(attendancePromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('Attendance logging errors:', errors);
        Alert.alert('Warning', 'Some attendance records may not have been saved properly');
        return false;
      }

      console.log('Attendance saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance records');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleContinueToPackaging = async () => {
    if (!toolboxCompleted) {
      Alert.alert('Warning', 'Please confirm toolbox briefing is completed first');
      return;
    }

    const saved = await saveAttendance();
    if (saved) {
      router.push({
        pathname: '/(packer)/packaging-dossier',
        params: { orderId }
      });
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        Alert.alert('Error', 'Failed to sign out');
      } else {
        // Force navigation to login after successful sign out
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

  const handleMouseUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleLongPress = (name: string, period: TimePeriod, timeType: 'start' | 'end') => {
    // Handle manual time entry if needed in the future
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-100">
      {/* Header */}
      <View className="flex-row justify-between items-center p-4">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="flex-row items-center"
        >
          <ArrowLeft size={24} color="#000" />
          <Text className="ml-2 text-lg font-semibold">Back</Text>
        </TouchableOpacity>
        
        <Text className="text-2xl font-semibold">Attendance Sheet & Tool Box</Text>
        
        <View className="flex-row items-center gap-4">
          <Clock />
          <TouchableOpacity 
            onPress={handleSignOut}
            className="bg-blue-500 px-3 py-1 rounded"
          >
            <Text className="text-white text-sm">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 mx-4 mb-4">
        <View className="bg-white rounded-lg shadow-md flex-1">
          <View className="bg-blue-500 px-4 py-3 rounded-t-lg">
            <Text className="text-white text-xl font-medium">
              Mark Attendance
            </Text>
          </View>

          {/* Project Header */}
          {order && (
            <ProjectHeader 
              projectName={order.order_name}
              projectLead={projectLead}
              packers={packers}
            />
          )}

          {/* Attendance Table */}
          <View className="flex-1">
            <AttendanceTable 
              names={packers}
              attendance={attendance}
              isAfternoon={isAfternoon}
              onPresenceToggle={togglePresence}
              onToggleTime={toggleStartEndTime}
              onLongPress={handleLongPress}
              onMouseUp={handleMouseUp}
              onClearEndTime={clearEndTime}
              onBulkPresenceToggle={bulkTogglePresence}
              onBulkTimeToggle={bulkToggleTime}
            />
          </View>

          {/* Footer with Submit Button */}
          <View className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            {!toolboxCompleted && (
              <TouchableOpacity
                onPress={() => setToolboxCompleted(true)}
                className="mb-4 py-3 px-6 rounded-lg bg-orange-500"
              >
                <Text className="text-center font-semibold text-white">
                  Confirm Toolbox Briefing Completed
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              onPress={handleContinueToPackaging}
              disabled={!toolboxCompleted || saving}
              className={`py-3 px-6 rounded-lg ${
                !toolboxCompleted || saving
                  ? 'bg-gray-300'
                  : 'bg-blue-500'
              }`}
            >
              <Text className={`text-center font-semibold ${
                !toolboxCompleted || saving
                  ? 'text-gray-500'
                  : 'text-white'
              }`}>
                {saving ? 'Saving Attendance...' : 'Continue to Packaging Dossier'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
