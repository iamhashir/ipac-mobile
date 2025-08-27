import React from 'react';
import { usePackerSession } from '../utils/PackerSessionContext';
import { View, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutDashboard, CalendarCheck, Package as PackageIcon } from 'lucide-react-native';

interface NavigationButtonsProps {
  currentScreen: string;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({ currentScreen }) => {
  const router = useRouter();
  const { session } = usePackerSession();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isCompact = isLandscape && height < 450;

  const navigateTo = (screen: string) => {
    if (screen !== currentScreen) {
      const sessionOrderId = session?.order_id ? `?orderId=${session.order_id}` : '';
      router.push(`/(packer)/${screen}${sessionOrderId}`);
    }
  };

  const sizeCls = isCompact ? 'px-3 py-1.5' : 'px-4 py-2';
  const textCls = isCompact ? 'text-xs' : 'text-sm';
  const iconOnly = width < 420; // when space is tight, show icons only
  const btnCls = iconOnly 
    ? 'w-10 h-10 bg-primary-500 rounded-lg items-center justify-center'
    : `${sizeCls} bg-primary-500 rounded-lg flex-row items-center justify-center space-x-2`;

  return (
    <View className={`${isCompact ? 'py-1' : 'py-2'} flex-row justify-center ${isCompact ? 'space-x-2' : 'space-x-4'}`}>
      <TouchableOpacity onPress={() => navigateTo('dashboard')} className={btnCls}>
        <LayoutDashboard size={iconOnly ? 18 : (isCompact ? 14 : 16)} color="#ffffff" />
        {!iconOnly && <Text className={`${textCls} text-white font-semibold`}>Dashboard</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo('attendance')} className={btnCls}>
        <CalendarCheck size={iconOnly ? 18 : (isCompact ? 14 : 16)} color="#ffffff" />
        {!iconOnly && <Text className={`${textCls} text-white font-semibold`}>Attendance</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo('packaging-dossier')} className={btnCls}>
        <PackageIcon size={iconOnly ? 18 : (isCompact ? 14 : 16)} color="#ffffff" />
        {!iconOnly && <Text className={`${textCls} text-white font-semibold`}>Packaging Dossier</Text>}
      </TouchableOpacity>
    </View>
  );
};

