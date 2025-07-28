import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { db } from '../../utils/api/supabase';

interface EndWorkProps {
  orderId: string;
  packerId: string;
  packerName: string;
  shiftPeriod: 'morning' | 'afternoon';
  onUpdate: () => void;
}

export const EndWork: React.FC<EndWorkProps> = ({
  orderId,
  packerId,
  packerName,
  shiftPeriod,
  onUpdate
}) => {
  const [updating, setUpdating] = useState(false);

  const handleEndWork = async () => {
    try {
      setUpdating(true);
      const endTime = new Date().toISOString();
      
      const { error } = await db.updateAttendanceEndTimeByDetails(
        orderId,
        packerId,
        shiftPeriod,
        endTime
      );

      if (error) {
        console.error('Error updating end time:', error);
        Alert.alert('Error', 'Failed to record end time');
      } else {
        Alert.alert('Success', `End time recorded for ${packerName}`);
        onUpdate();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleEndWork}
      disabled={updating}
      className={`py-2 px-4 rounded ${
        updating ? 'bg-gray-300' : 'bg-red-500'
      }`}
    >
      <Text className={`text-center font-medium ${
        updating ? 'text-gray-500' : 'text-white'
      }`}>
        {updating ? 'Updating...' : 'End Work'}
      </Text>
    </TouchableOpacity>
  );
};
