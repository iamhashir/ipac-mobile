import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { db } from '../../../utils/api/supabase';

interface AttendanceRecord {
  packer_id: string;
  packer_name: string;
  morning_present: boolean | null;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_present: boolean | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
}

interface AttendanceMonitorProps {
  orderId: string;
}

export default function AttendanceMonitor({ orderId }: AttendanceMonitorProps) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  useEffect(() => {
    loadAvailableDates();
  }, [orderId]);

  useEffect(() => {
    loadAttendance();
    
    // Only auto-refresh if viewing today
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    if (!isToday) return;

    const interval = setInterval(() => {
      loadAttendance();
    }, 30000);

    return () => clearInterval(interval);
  }, [orderId, selectedDate]);

  const loadAvailableDates = async () => {
    try {
      // Get all attendance records for this order (optimized query)
      const { data: attendanceRecords } = await db.getAllAttendanceForOrder(orderId);
      
      // Extract unique dates from attendance logs
      const datesSet = new Set<string>();
      
      if (attendanceRecords && attendanceRecords.length > 0) {
        attendanceRecords.forEach((record: any) => {
          if (record.log_date) {
            datesSet.add(record.log_date);
          }
        });
      }

      // Always include today even if no attendance yet
      const today = new Date().toISOString().split('T')[0];
      datesSet.add(today);

      // Sort dates in descending order (most recent first)
      const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
      setAvailableDates(sortedDates);
    } catch (error) {
      console.error('Error loading dates:', error);
      // Fallback to showing today
      setAvailableDates([new Date().toISOString().split('T')[0]]);
    }
  };

  const loadAttendance = async () => {
    try {
      setLoading(true);
      
      // Get all packers for this order
      const { data: packersData } = await db.getOrderPackers(orderId);
      if (!packersData || packersData.length === 0) {
        setAttendanceRecords([]);
        return;
      }

      const records: AttendanceRecord[] = [];

      // For each packer, get their attendance records for today
      for (const packer of packersData) {
        const packerId = packer.packer_id || packer.id;
        const packerName = packer.full_name || packer.username || 'Unknown';
        
        const { data: attendanceLogs } = await db.getPackerAttendanceByOrderAndDate(
          orderId,
          packerId,
          selectedDate
        );

        // Process morning and afternoon records
        const morningRecord = (attendanceLogs || []).find((log: any) => log.shift_period === 'morning');
        const afternoonRecord = (attendanceLogs || []).find((log: any) => log.shift_period === 'afternoon');

        records.push({
          packer_id: packerId,
          packer_name: packerName,
          morning_present: morningRecord ? (morningRecord.status === 'present') : null,
          morning_start: morningRecord?.start_time ? formatTime(morningRecord.start_time) : null,
          morning_end: morningRecord?.end_time ? formatTime(morningRecord.end_time) : null,
          afternoon_present: afternoonRecord ? (afternoonRecord.status === 'present') : null,
          afternoon_start: afternoonRecord?.start_time ? formatTime(afternoonRecord.start_time) : null,
          afternoon_end: afternoonRecord?.end_time ? formatTime(afternoonRecord.end_time) : null,
        });
      }

      setAttendanceRecords(records);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return '—';
    }
  };

  const getStatusColor = (present: boolean | null): string => {
    if (present === null) return 'bg-gray-100 border-gray-300 text-gray-600';
    return present ? 'bg-green-50 border-green-400 text-green-700' : 'bg-red-50 border-red-400 text-red-700';
  };

  const getStatusText = (present: boolean | null): string => {
    if (present === null) return 'Not Marked';
    return present ? 'Present' : 'Absent';
  };

  const calculateDuration = (start: string | null, end: string | null): string => {
    if (!start) return '—';
    
    const startTime = new Date(`1970-01-01T${start}:00Z`);
    const endTime = end ? new Date(`1970-01-01T${end}:00Z`) : new Date();
    
    const diffMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  if (loading && attendanceRecords.length === 0) {
    return (
      <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <View className="flex-row items-center justify-center py-4">
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text className="ml-2 text-gray-600">Loading attendance...</Text>
        </View>
      </View>
    );
  }

  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateString === today) return 'Today';
    if (dateString === yesterdayStr) return 'Yesterday';
    
    return date.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: '2-digit', 
      month: 'short' 
    });
  };

  return (
    <View className="bg-white rounded-lg border border-gray-200 mb-4">
      {/* Header */}
      <View className="px-4 py-3 bg-blue-50 border-b border-blue-200 rounded-t-lg">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-lg font-semibold text-blue-900">Packer Attendance</Text>
          <Text className="text-xs text-blue-700">Last updated: {lastRefresh.toLocaleTimeString()}</Text>
        </View>
        
        {/* Date Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {availableDates.map((date) => (
            <TouchableOpacity
              key={date}
              onPress={() => setSelectedDate(date)}
              className={`px-3 py-1.5 mr-2 rounded-lg border ${
                selectedDate === date
                  ? 'bg-blue-600 border-blue-700'
                  : 'bg-white border-blue-300'
              }`}
            >
              <Text className={`text-xs font-medium ${
                selectedDate === date ? 'text-white' : 'text-blue-700'
              }`}>
                {formatDateDisplay(date)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Attendance Table */}
      {attendanceRecords.length === 0 ? (
        <View className="px-4 py-6">
          <Text className="text-center text-gray-500">No packers assigned to this order</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} className="px-4 py-3">
          <View>
            {/* Table Header */}
            <View className="flex-row border-b border-gray-300 pb-2 mb-2">
              <View className="w-40 pr-2">
                <Text className="font-semibold text-gray-700">Packer</Text>
              </View>
              <View className="w-32 pr-2">
                <Text className="font-semibold text-gray-700 text-center">Morning Status</Text>
              </View>
              <View className="w-24 pr-2">
                <Text className="font-semibold text-gray-700 text-center">Start</Text>
              </View>
              <View className="w-24 pr-2">
                <Text className="font-semibold text-gray-700 text-center">End</Text>
              </View>
              <View className="w-24 pr-2">
                <Text className="font-semibold text-gray-700 text-center">Duration</Text>
              </View>
              <View className="w-32 pr-2">
                <Text className="font-semibold text-gray-700 text-center">Afternoon Status</Text>
              </View>
              <View className="w-24 pr-2">
                <Text className="font-semibold text-gray-700 text-center">Start</Text>
              </View>
              <View className="w-24 pr-2">
                <Text className="font-semibold text-gray-700 text-center">End</Text>
              </View>
              <View className="w-24">
                <Text className="font-semibold text-gray-700 text-center">Duration</Text>
              </View>
            </View>

            {/* Table Rows */}
            {attendanceRecords.map((record) => (
              <View key={record.packer_id} className="flex-row py-2 border-b border-gray-100">
                {/* Packer Name */}
                <View className="w-40 pr-2 justify-center">
                  <Text className="text-gray-900">{record.packer_name}</Text>
                </View>

                {/* Morning Status */}
                <View className="w-32 pr-2 justify-center">
                  <View className={`px-2 py-1 rounded border ${getStatusColor(record.morning_present)}`}>
                    <Text className={`text-xs font-medium text-center ${getStatusColor(record.morning_present).split(' ').pop()}`}>
                      {getStatusText(record.morning_present)}
                    </Text>
                  </View>
                </View>

                {/* Morning Start */}
                <View className="w-24 pr-2 justify-center">
                  <Text className="text-sm text-gray-700 text-center">
                    {record.morning_start || '—'}
                  </Text>
                </View>

                {/* Morning End */}
                <View className="w-24 pr-2 justify-center">
                  <Text className="text-sm text-gray-700 text-center">
                    {record.morning_end || '—'}
                  </Text>
                </View>

                {/* Morning Duration */}
                <View className="w-24 pr-2 justify-center">
                  <Text className="text-sm text-gray-600 text-center">
                    {record.morning_present ? calculateDuration(record.morning_start, record.morning_end) : '—'}
                  </Text>
                </View>

                {/* Afternoon Status */}
                <View className="w-32 pr-2 justify-center">
                  <View className={`px-2 py-1 rounded border ${getStatusColor(record.afternoon_present)}`}>
                    <Text className={`text-xs font-medium text-center ${getStatusColor(record.afternoon_present).split(' ').pop()}`}>
                      {getStatusText(record.afternoon_present)}
                    </Text>
                  </View>
                </View>

                {/* Afternoon Start */}
                <View className="w-24 pr-2 justify-center">
                  <Text className="text-sm text-gray-700 text-center">
                    {record.afternoon_start || '—'}
                  </Text>
                </View>

                {/* Afternoon End */}
                <View className="w-24 pr-2 justify-center">
                  <Text className="text-sm text-gray-700 text-center">
                    {record.afternoon_end || '—'}
                  </Text>
                </View>

                {/* Afternoon Duration */}
                <View className="w-24 justify-center">
                  <Text className="text-sm text-gray-600 text-center">
                    {record.afternoon_present ? calculateDuration(record.afternoon_start, record.afternoon_end) : '—'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
