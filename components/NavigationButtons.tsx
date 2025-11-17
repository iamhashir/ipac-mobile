import React from 'react';
import { usePackerSession } from '../utils/PackerSessionContext';
import { View, TouchableOpacity, Text, useWindowDimensions, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutDashboard, CalendarCheck, Package as PackageIcon, Settings as SettingsIcon } from 'lucide-react-native';
import { useTextSize } from '../utils/TextSizeContext';

interface NavigationButtonsProps {
  currentScreen: string;
  iconsOnly?: boolean;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({ currentScreen, iconsOnly }) => {
  const router = useRouter();
  const { session, canAccessAttendance, canAccessPackaging } = usePackerSession();
  const { width, height } = useWindowDimensions();
  const { size } = useTextSize();
  const isLandscape = width > height;
  const isCompact = isLandscape && height < 450;

  const attendanceAllowed = canAccessAttendance();
  const packagingAllowed = canAccessPackaging();

  const navigateTo = (screen: string) => {
    if (screen !== currentScreen) {
      const sessionOrderId = session?.order_id ? `?orderId=${session.order_id}` : '';
      router.push(`/(packer)/${screen}${sessionOrderId}` as any);
    }
  };

  const handleAttendancePress = () => {
    if (attendanceAllowed) {
      navigateTo('attendance');
      return;
    }
    Alert.alert(
      'Access Denied',
      'You must first select a team and project before accessing attendance.',
      [
        { text: 'Go to Dashboard', onPress: () => navigateTo('dashboard') },
        { text: 'OK' },
      ]
    );
  };

  const handlePackagingPress = () => {
    if (packagingAllowed) {
      navigateTo('packing-list');
      return;
    }
    let message = 'You must complete the following steps first:\n';
    if (!attendanceAllowed) {
      message += '• Select a team and project\n';
    }
    if (!session?.attendance_completed) {
      message += '• Complete attendance logging\n';
    }
    Alert.alert(
      'Access Denied',
      message.trim(),
      [
        {
          text: attendanceAllowed ? 'Go to Attendance' : 'Go to Dashboard',
          onPress: () => navigateTo(attendanceAllowed ? 'attendance' : 'dashboard'),
        },
        { text: 'OK' },
      ]
    );
  };

  // Scale padding, text and icon sizes with selected text size
  const iconOnlyFlag = !!iconsOnly || width < 420; // allow override or fallback to width check
  const sizeCls = (() => {
    if (iconOnlyFlag) return '';
    if (size === 'large') return isCompact ? 'px-3.5 py-2' : 'px-5 py-2.5';
    if (size === 'small') return isCompact ? 'px-2.5 py-1.5' : 'px-3.5 py-1.5';
    return isCompact ? 'px-3 py-1.5' : 'px-4 py-2';
  })();
  const textCls = (() => {
    if (size === 'large') return isCompact ? 'text-sm' : 'text-base';
    if (size === 'small') return isCompact ? 'text-[10px]' : 'text-xs';
    return isCompact ? 'text-xs' : 'text-sm';
  })();
  const iconSize = (() => {
    if (iconOnlyFlag) return 18;
    if (size === 'large') return isCompact ? 18 : 20;
    if (size === 'small') return isCompact ? 12 : 14;
    return isCompact ? 14 : 16;
  })();

  const baseBtnCls = (enabled: boolean) => iconOnlyFlag
    ? `w-10 h-10 ${enabled ? 'bg-primary-500' : 'bg-gray-300'} rounded-lg items-center justify-center`
    : `${sizeCls} ${enabled ? 'bg-primary-500' : 'bg-gray-300'} rounded-lg flex-row items-center justify-center space-x-2`;

  const baseTextCls = (enabled: boolean) => `${textCls} ${enabled ? 'text-white' : 'text-gray-500'} font-semibold`;

  return (
    <View className={`${isCompact ? 'py-1' : 'py-2'} flex-row justify-end me-4 ${isCompact ? 'gap-x-2' : 'gap-x-4'}`}>
      <TouchableOpacity onPress={() => navigateTo('dashboard')} className={baseBtnCls(true)}>
        <LayoutDashboard size={iconSize} color="#ffffff" />
        {!iconOnlyFlag && <Text className={baseTextCls(true)}> Dashboard</Text>}
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={handleAttendancePress}
        activeOpacity={attendanceAllowed ? 0.7 : 1}
        className={baseBtnCls(attendanceAllowed)}
      >
        <CalendarCheck size={iconSize} color={attendanceAllowed ? '#ffffff' : '#6b7280'} />
        {!iconOnlyFlag && <Text className={baseTextCls(attendanceAllowed)}> Attendance</Text>}
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={handlePackagingPress}
        activeOpacity={packagingAllowed ? 0.7 : 1}
        className={baseBtnCls(packagingAllowed)}
      >
        <PackageIcon size={iconSize} color={packagingAllowed ? '#ffffff' : '#6b7280'} />
        {!iconOnlyFlag && <Text className={baseTextCls(packagingAllowed)}> Packing List</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigateTo('settings')} className={baseBtnCls(true)}>
        <SettingsIcon size={iconSize} color="#ffffff" />
        {!iconOnlyFlag && <Text className={baseTextCls(true)}> Settings</Text>}
      </TouchableOpacity>
    </View>
  );
};

