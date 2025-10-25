import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { usePackerSession } from '../../utils/PackerSessionContext';
import { db } from '../../utils/api/supabase';
import { ProjectHeader } from '../../components/packer/attendance/ProjectHeader';
import { AttendanceTable } from '../../components/packer/attendance/AttendanceTable';
import { Clock } from '../../components/packer/attendance/Clock';
import { ArrowLeft } from 'lucide-react-native';
import { NavigationButtons } from '../../components/NavigationButtons';
import { ErrorAlert } from '../../components/ui/Alert';
import { teamLead } from '../../utils/api/teamLead';

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
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isCompact = isLandscape && height < 450;
  const isPortraitPhone = !isLandscape && width < 480;
  
  // Guard: require team selection session before accessing attendance
  const { session, loading: sessionLoading, canAccessAttendance, markAttendanceCompleted } = usePackerSession();
  useEffect(() => {
    if (!sessionLoading) {
      if (!canAccessAttendance()) {
        Alert.alert('Access Denied', 'Please complete team selection before accessing attendance.', [
          { text: 'Go to Dashboard', onPress: () => router.replace('/(packer)/dashboard') }
        ]);
      }
    }
  }, [sessionLoading, canAccessAttendance]);
  
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
  const [errorAlert, setErrorAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Parse parameters - get from session if not in params
  const orderId = (params.orderId as string) || session?.order_id;

  useEffect(() => {
    if (orderId) {
      loadData();
      checkAfternoonTime();
    }
  }, [orderId]);

  // Auto-mark afternoon attendance when crossing 12pm for packers present in morning
  useEffect(() => {
    if (!orderId || packers.length === 0) return;

    const checkAndAutoMarkAfternoon = async () => {
      const now = new Date();
      const hour = now.getHours();
      
      // Only auto-mark when it's afternoon (>= 12pm) and hasn't been done yet
      if (hour >= 12) {
        // Check each packer who was present in morning but not marked for afternoon yet
        for (const name of packers) {
          const packerAttendance = attendance[name];
          
          // If packer was present in morning and afternoon is not yet marked
          if (packerAttendance?.morning.present === true && 
              packerAttendance?.afternoon.present !== true &&
              packerAttendance?.afternoon.present !== false) {
            
            const packerData = packersData.find(p => p.full_name === name);
            if (!packerData) continue;

            try {
              // Check if we can record afternoon attendance
              const { data: canRecord } = await db.canRecordAttendance(
                orderId,
                packerData.packer_id || packerData.id,
                'afternoon'
              );

              if (canRecord) {
                // Automatically mark afternoon attendance
                const currentTime = getCurrentTime();
                const today = new Date().toISOString().split('T')[0];
                const startTimeISO = new Date(`${today} ${currentTime}`).toISOString();

                const { error } = await db.logAttendance(
                  orderId,
                  packerData.packer_id || packerData.id,
                  'afternoon',
                  'present',
                  startTimeISO,
                  null,
                  toolboxCompleted,
                  false
                );

                if (!error) {
                  // Update local state
                  setAttendance(prevAttendance => ({
                    ...prevAttendance,
                    [name]: {
                      ...prevAttendance[name],
                      afternoon: {
                        ...prevAttendance[name].afternoon,
                        present: true,
                        startTime: currentTime,
                        endTime: null
                      }
                    }
                  }));
                  console.log(`Auto-marked afternoon attendance for ${name}`);
                }
              }
            } catch (error) {
              console.error(`Error auto-marking afternoon for ${name}:`, error);
            }
          }
        }
      }
    };

    // Check immediately
    checkAndAutoMarkAfternoon();

    // Check every minute for time changes
    const interval = setInterval(checkAndAutoMarkAfternoon, 60000);

    return () => clearInterval(interval);
  }, [orderId, packers, packersData, attendance, toolboxCompleted]);

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

      // Fallback: if order has no project_lead_name, fetch team lead from team members
      if (!orderData.project_lead_name) {
        const { data: leadData, error: leadError } = await teamLead.getOrderTeamLead(orderId);
        if (!leadError && leadData?.profiles?.full_name) {
          setProjectLead(leadData.profiles.full_name);
        }
      }

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
      
      // Load existing attendance data from database
await loadExistingAttendance(packersResponse, initialAttendance);

      // Fetch project lead
      if (orderData.project_lead_name) {
        setProjectLead(orderData.project_lead_name);
      }

    } catch (error) {
      console.error('Error in loadData:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAttendance = async (packersResponse: any[], initialAttendance: AttendanceRecord) => {
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Load existing attendance records for each packer
      for (const packer of packersResponse) {
        const packerId = packer.packer_id || packer.id;
        const packerName = packer.full_name;
        
        // Get attendance records for this packer and order today
        const { data: attendanceRecords, error } = await db.getPackerAttendanceByOrderAndDate(
          orderId,
          packerId,
          today
        );
        
        if (error) {
          console.error(`Error loading attendance for ${packerName}:`, error);
          continue;
        }
        
        if (attendanceRecords && attendanceRecords.length > 0) {
          // Process attendance records and update state
          const morningRecord = attendanceRecords.find(r => r.shift_period === 'morning');
          const afternoonRecord = attendanceRecords.find(r => r.shift_period === 'afternoon');
          
          if (morningRecord) {
            initialAttendance[packerName].morning = {
              present: morningRecord.status === 'present',
              startTime: morningRecord.start_time ? formatTimeFromISO(morningRecord.start_time) : null,
              endTime: morningRecord.end_time ? formatTimeFromISO(morningRecord.end_time) : null,
              manualStart: false,
              manualEnd: false
            };
          }
          
          if (afternoonRecord) {
            initialAttendance[packerName].afternoon = {
              present: afternoonRecord.status === 'present',
              startTime: afternoonRecord.start_time ? formatTimeFromISO(afternoonRecord.start_time) : null,
              endTime: afternoonRecord.end_time ? formatTimeFromISO(afternoonRecord.end_time) : null,
              manualStart: false,
              manualEnd: false
            };
          }
          
          // Check if toolbox briefing was completed for CURRENT shift only
          const currentShift: TimePeriod = isAfternoon ? 'afternoon' : 'morning';
          if (attendanceRecords.some(r => r.shift_period === currentShift && r.toolbox_briefing_completed)) {
            setToolboxCompleted(true);
          }
        }
      }
      
      // Update attendance state with loaded data
      setAttendance(initialAttendance);
      console.log('Existing attendance data loaded from database');
      
    } catch (error) {
      console.error('Error loading existing attendance:', error);
    }
  };
  
  const formatTimeFromISO = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const checkAfternoonTime = () => {
    const now = new Date();
    const hour = now.getHours();
    setIsAfternoon(hour >= 12);
  };

  const isMorning = () => {
    const now = new Date();
    const hour = now.getHours();
    return hour < 12;
  };

  const togglePresence = async (name: string, period: TimePeriod, isPresent: boolean) => {
    // First check if user has permission to mark attendance
    const { data: canMarkAttendance, error: permissionError } = await db.canUserMarkAttendance(orderId);
    
    if (permissionError) {
      console.error('Error checking attendance permissions:', permissionError);
      Alert.alert('Error', 'Failed to verify permissions');
      return;
    }
    
    if (!canMarkAttendance) {
      // Show alert for packers trying to mark their own attendance
      Alert.alert(
        'Permission Denied', 
        'Only team leaders and administrators can mark attendance. Please contact your project lead if you need to update your attendance status.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    
    const packerData = packersData.find(p => p.full_name === name);
    if (!packerData) {
      Alert.alert('Error', 'Packer data not found');
      return;
    }
    
    if (isPresent) {
      // Check if attendance can be recorded (prevents spam clicking)
      const { data: canRecord, error: validationError } = await db.canRecordAttendance(
        orderId, 
        packerData.packer_id || packerData.id, 
        period
      );
      
      if (validationError) {
        console.error('Error validating attendance recording:', validationError);
        Alert.alert('Error', 'Failed to validate attendance recording');
        return;
      }
      
      if (!canRecord) {
        Alert.alert(
          'Already Recorded', 
          `${name} already has active attendance for ${period}. Please mark their end time first if they need to restart their shift.`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      // When marking as present, automatically set start time and record attendance
      await recordAttendanceForPacker(name, period);
    } else {
      // When marking as absent, record this in the database and update local state
      await recordAbsentForPacker(name, period);
    }
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

  const recordAbsentForPacker = async (name: string, period: TimePeriod) => {
    const packerData = packersData.find(p => p.full_name === name);
    if (!packerData) {
      Alert.alert('Error', 'Packer data not found');
      return;
    }

    try {
      // Log absent attendance record to database
      const { error } = await db.logAttendance(
        orderId,
        packerData.packer_id || packerData.id,
        period,
        'absent',
        null, // no start time for absent
        null, // no end time for absent
        toolboxCompleted,
        false // not project start for absent
      );

      if (error) {
        console.error('Error logging absent attendance:', error);
        Alert.alert('Error', `Failed to record absent status for ${name}`);
        return;
      }

      // Update local state to show absent
      setAttendance(prevAttendance => ({
        ...prevAttendance,
        [name]: {
          ...prevAttendance[name],
          [period]: {
            ...prevAttendance[name][period],
            present: false,
            startTime: null,
            endTime: null
          }
        }
      }));

      console.log(`Absent attendance recorded for ${name} - ${period}`);
    } catch (error) {
      console.error('Error in recordAbsentForPacker:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const recordAttendanceForPacker = async (name: string, period: TimePeriod) => {
    const packerData = packersData.find(p => p.full_name === name);
    if (!packerData) {
      Alert.alert('Error', 'Packer data not found');
      return;
    }

    try {
      const currentTime = getCurrentTime();
      const today = new Date().toISOString().split('T')[0];
      const startTimeISO = new Date(`${today} ${currentTime}`).toISOString();
      
      // Log attendance record to database
      const { error } = await db.logAttendance(
        orderId,
        packerData.packer_id || packerData.id,
        period,
        'present',
        startTimeISO,
        null, // no end time yet
        toolboxCompleted,
        period === 'morning' // is_project_start only for morning
      );

      if (error) {
        console.error('Error logging attendance:', error);
        Alert.alert('Error', `Failed to record attendance for ${name}`);
        return;
      }

      // Update local state to show present with start time
      setAttendance(prevAttendance => ({
        ...prevAttendance,
        [name]: {
          ...prevAttendance[name],
          [period]: {
            ...prevAttendance[name][period],
            present: true,
            startTime: currentTime,
            endTime: null
          }
        }
      }));

      console.log(`Attendance recorded for ${name} - ${period}`);
    } catch (error) {
      console.error('Error in recordAttendanceForPacker:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const bulkTogglePresence = async (period: TimePeriod, isPresent: boolean) => {
    // First check if user has permission to mark attendance
    const { data: canMarkAttendance, error: permissionError } = await db.canUserMarkAttendance(orderId);
    
    if (permissionError) {
      console.error('Error checking attendance permissions:', permissionError);
      Alert.alert('Error', 'Failed to verify permissions');
      return;
    }
    
    if (!canMarkAttendance) {
      Alert.alert(
        'Permission Denied', 
        'Only team leaders and administrators can mark attendance.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    
    if (isPresent) {
      // When bulk marking as present, validate each packer first
      const validPackers = [];
      
      for (const name of packers) {
        const packerData = packersData.find(p => p.full_name === name);
        if (!packerData) continue;
        
        const { data: canRecord } = await db.canRecordAttendance(
          orderId, 
          packerData.packer_id || packerData.id, 
          period
        );
        
        if (canRecord) {
          validPackers.push(name);
        }
      }
      
      if (validPackers.length === 0) {
        Alert.alert('Already Recorded', `All packers already have active attendance for ${period}.`);
        return;
      }
      
      if (validPackers.length < packers.length) {
        const skippedCount = packers.length - validPackers.length;
        Alert.alert(
          'Partial Update', 
          `${skippedCount} packer(s) already have active attendance and will be skipped.`,
          [{ text: 'Continue', onPress: () => {
            const promises = validPackers.map(name => recordAttendanceForPacker(name, period));
            Promise.all(promises);
          }}, { text: 'Cancel' }]
        );
        return;
      }
      
      // Record attendance for all valid packers
      const promises = validPackers.map(name => recordAttendanceForPacker(name, period));
      await Promise.all(promises);
    } else {
      // When bulk marking as absent, record absent status for all packers
      const promises = packers.map(name => recordAbsentForPacker(name, period));
      await Promise.all(promises);
    }
  };

  const bulkToggleTime = async (period: TimePeriod, timeType: 'start' | 'end') => {
    if (timeType === 'end') {
      const newTime = new Date().toISOString();
      const promises = packers.map(name => {
        const packerData = packersData.find(p => p.full_name === name);
        if (!packerData || !attendance[name][period].present || !attendance[name][period].startTime) {
          return Promise.resolve(); // skip if no valid attendance to end
        }
        return db.updateAttendanceEndTimeByDetails(orderId, packerData.packer_id || packerData.id, period, newTime);
      });
      await Promise.all(promises);

      const updatedAttendance = { ...attendance };
      packers.forEach(name => {
        if (updatedAttendance[name][period].present) {
          updatedAttendance[name][period].endTime = getCurrentTime();
        }
      });
      setAttendance(updatedAttendance);
      console.log(`All ${period} end times recorded.`);
    } else {
      // Start time logic (though now it's automatic and just a text display)
      const newTime = getCurrentTime();
      const updatedAttendance = { ...attendance };
      packers.forEach(name => {
        if (updatedAttendance[name][period].present) {
          updatedAttendance[name][period].startTime = newTime;
        }
      });
      setAttendance(updatedAttendance);
    }
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

  const recordNewAttendance = async (name: string, period: TimePeriod) => {
    const packerData = packersData.find(p => p.full_name === name);
    if (!packerData) {
      Alert.alert('Error', 'Packer data not found');
      return;
    }

    try {
      const currentTime = getCurrentTime();
      const today = new Date().toISOString().split('T')[0];
      const startTimeISO = new Date(`${today} ${currentTime}`).toISOString();
      
      // Always create a new attendance log (like Present button does)
      const { error } = await db.logAttendance(
        orderId,
        packerData.packer_id || packerData.id,
        period,
        'present',
        startTimeISO,
        null, // no end time yet
        toolboxCompleted,
        false // not project start since it's a return
      );

      if (error) {
        console.error('Error logging new attendance:', error);
        Alert.alert('Error', 'Failed to record new attendance');
        return;
      }

      // Update local state to show new start time
      setAttendance(prevAttendance => ({
        ...prevAttendance,
        [name]: {
          ...prevAttendance[name],
          [period]: {
            ...prevAttendance[name][period],
            startTime: currentTime,
            endTime: null,
            present: true
          }
        }
      }));

      console.log(`New attendance log created for ${name} - ${period}`);
    } catch (error) {
      console.error('Error in recordNewAttendance:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const endWork = async (name: string, period: TimePeriod) => {
    const packerData = packersData.find(p => p.full_name === name);
    if (!packerData) {
      Alert.alert('Error', 'Packer data not found');
      return;
    }

    const attendanceEntry = attendance[name]?.[period];
    if (!attendanceEntry?.present || !attendanceEntry?.startTime) {
      Alert.alert('Error', 'No active attendance found to end');
      return;
    }

    try {
      const endTime = new Date().toISOString();
      
      const { error } = await db.updateAttendanceEndTimeByDetails(
        orderId,
        packerData.packer_id || packerData.id,
        period,
        endTime
      );

      if (error) {
        console.error('Error updating end time:', error);
        Alert.alert('Error', 'Failed to record end time');
        return;
      }

      const endTimeFormatted = getCurrentTime();
      setAttendance(prevAttendance => ({
        ...prevAttendance,
        [name]: {
          ...prevAttendance[name],
          [period]: {
            ...prevAttendance[name][period],
            endTime: endTimeFormatted,
          }
        }
      }));

      Alert.alert('Success', `Work ended for ${name}`);
    } catch (error) {
      console.error('Error in endWork:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
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
    // Since attendance is now saved immediately when Present buttons are pressed,
    // we just need to validate that required attendance exists and proceed
    setSaving(true);
    try {
      // Check if at least one packer is marked as present
      const hasPresentPackers = packers.some(name => {
        const packerAttendance = attendance[name];
        return packerAttendance?.morning.present === true || packerAttendance?.afternoon.present === true;
      });

      if (!hasPresentPackers) {
        Alert.alert('Warning', 'No packers marked as present. Please mark attendance before continuing.');
        return false;
      }

      console.log('Attendance validation successful - records already saved when Present buttons were pressed');
      return true;
    } catch (error) {
      console.error('Error validating attendance:', error);
      Alert.alert('Error', 'An unexpected error occurred');
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
      // Mark session attendance as completed so Packaging gate allows entry
      const marked = await markAttendanceCompleted();
      if (!marked) {
        Alert.alert('Error', 'Could not mark attendance as completed. Please try again or contact your team lead.');
        return;
      }
      router.push({
        pathname: '/(packer)/packing-report',
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
      <SafeAreaView className="flex-1 bg-gray-50" edges={['top','bottom','left','right']}>
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

  // Derived: whether at least one packer is marked present
  const hasPresentPackers = packers.some(name => {
    const packerAttendance = attendance[name];
    return packerAttendance?.morning.present === true || packerAttendance?.afternoon.present === true;
  });

  return (
    <SafeAreaView className="flex-1 bg-primary-50" edges={['top','bottom','left','right']}>
      {/* Header */}
      <View className={`${isCompact ? 'px-3 py-2' : 'px-4 py-3'} bg-primary-500`}>
        {isPortraitPhone ? (
          <View className="space-y-1">
            <View className="flex-row justify-between items-center">
              <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
                <ArrowLeft size={20} color="#fff" />
                <Text className="ml-2 text-white text-sm font-semibold">Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSignOut} className="px-2 py-1 bg-primary-600 rounded">
                <Text className="text-white text-xs">Sign Out</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-lg font-bold">Attendance Sheet & Tool Box</Text>
              <Clock textClassName="text-white" />
            </View>
          </View>
        ) : (
          <View className="flex-row justify-between items-center">
            <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
              <ArrowLeft size={24} color="#fff" />
              <Text className={`${isCompact ? 'ml-2 text-white text-sm font-semibold' : 'ml-2 text-white text-base font-semibold'}`}>Back</Text>
            </TouchableOpacity>
            <Text className={`${isCompact ? 'text-white text-lg font-bold' : 'text-white text-xl font-bold'}`}>Attendance Sheet & Tool Box</Text>
            <View className="flex-row items-center gap-4">
              <Clock textClassName="text-white" />
              <TouchableOpacity onPress={handleSignOut} className="bg-primary-600 px-3 py-1 rounded">
                <Text className="text-white text-sm">Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Navigation Buttons */}
      <NavigationButtons currentScreen="attendance" iconsOnly={isCompact} />

      {/* Error Alert */}
      <ErrorAlert
        visible={errorAlert.visible}
        title={errorAlert.title}
        message={errorAlert.message}
        onClose={() => setErrorAlert({visible: false, title: ''})}
        autoDismiss={true}
      />

      {/* Main Content */}
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: isCompact ? 12 : 16, paddingBottom: 16 }}>
        <View className="bg-white rounded-lg shadow-md">
          <View className="bg-primary-500 px-4 py-3 rounded-t-lg">
            <Text className={`${isCompact ? 'text-white text-lg font-medium' : 'text-white text-xl font-medium'}`}>
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
              isMorning={isMorning()}
              onPresenceToggle={togglePresence}
              onToggleTime={toggleStartEndTime}
              onLongPress={handleLongPress}
              onMouseUp={handleMouseUp}
              onClearEndTime={clearEndTime}
              onBulkPresenceToggle={bulkTogglePresence}
              onBulkTimeToggle={bulkToggleTime}
              onEndWork={endWork}
              onRecordNewAttendance={recordNewAttendance}
            />
          </View>

          {/* Footer with Submit Button */}
          <View className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            {!toolboxCompleted && hasPresentPackers && (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const shift: TimePeriod = isAfternoon ? 'afternoon' : 'morning';
                    // Persist at the order+shift level so it stays hidden when returning
                    await db.setToolboxBriefingForOrderShift(orderId, shift);
                  } catch (_) {}
                  setToolboxCompleted(true);
                }}
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
{saving ? 'Saving Attendance...' : 'Continue to Packing List'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
