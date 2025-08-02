import React from 'react';
import { usePackerSession } from '../utils/PackerSessionContext';
import { View, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';

interface NavigationButtonsProps {
  currentScreen: string;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({ currentScreen }) => {
  const router = useRouter();
  const { session } = usePackerSession();

  const navigateTo = (screen: string) => {
    if (screen !== currentScreen) {
      const sessionOrderId = session?.order_id ? `?orderId=${session.order_id}` : '';
      router.push(`/(packer)/${screen}${sessionOrderId}`);
    }
  };

  return (
    <View className="flex-row justify-center space-x-4 py-2">
      <TouchableOpacity onPress={() => navigateTo('dashboard')} className="px-4 py-2 bg-blue-500 rounded">
        <Text className="text-white font-semibold">Dashboard</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo('attendance')} className="px-4 py-2 bg-green-500 rounded">
        <Text className="text-white font-semibold">Attendance</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo('packaging-dossier')} className="px-4 py-2 bg-purple-500 rounded">
        <Text className="text-white font-semibold">Packaging Dossier</Text>
      </TouchableOpacity>
    </View>
  );
};

