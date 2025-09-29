import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  type: AlertType;
  title?: string;
  message?: string;
  onClose?: () => void;
  visible?: boolean;
  dismissible?: boolean;
  autoDismiss?: boolean;
  autoDismissTime?: number; // ms
  floating?: boolean; // position fixed to corner
  placement?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
}

// Bootstrap-like inline alert banner (can float like a toast)
export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  message,
  onClose,
  visible = true,
  dismissible = true,
  autoDismiss = true,
  autoDismissTime = 5000,
  floating = true,
  placement = 'bottom-right',
}) => {
  useEffect(() => {
    if (!autoDismiss || !visible) return;
    const id = setTimeout(() => {
      onClose && onClose();
    }, autoDismissTime);
    return () => clearTimeout(id);
  }, [autoDismiss, autoDismissTime, visible, onClose]);

  if (!visible) return null;

  const palette: Record<AlertType, {bg: string; text: string; border: string; icon: string}> = {
    success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: '✅' },
    error:   { bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-red-200',   icon: '⛔' },
    warning: { bg: 'bg-yellow-50',text: 'text-yellow-800',border: 'border-yellow-200',icon: '⚠️' },
    info:    { bg: 'bg-blue-50',  text: 'text-blue-800',  border: 'border-blue-200', icon: 'ℹ️' },
  };
  const c = palette[type];

  // placement classes for floating mode
  const placeMap: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4',
  };
  const floatWrap = `absolute ${placeMap[placement]} z-50 w-80`;

  if (floating) {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View className="flex-1">
          <View className={floatWrap}>
            <View className={`border ${c.border} ${c.bg} rounded-lg p-3 flex-row items-start shadow-lg`}>
              <Text className={`mr-2 ${c.text}`}>{c.icon}</Text>
              <View className="flex-1">
                {title ? <Text className={`font-semibold ${c.text}`}>{title}</Text> : null}
                {message ? <Text className={`${c.text}`}>{message}</Text> : null}
              </View>
              {dismissible && (
                <TouchableOpacity onPress={onClose} className="ml-2 px-2">
                  <Text className={`${c.text}`}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View className={`border ${c.border} ${c.bg} rounded-lg p-3 flex-row items-start shadow-lg`}>
      <Text className={`mr-2 ${c.text}`}>{c.icon}</Text>
      <View className="flex-1">
        {title ? <Text className={`font-semibold ${c.text}`}>{title}</Text> : null}
        {message ? <Text className={`${c.text}`}>{message}</Text> : null}
      </View>
      {dismissible && (
        <TouchableOpacity onPress={onClose} className="ml-2 px-2">
          <Text className={`${c.text}`}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Convenience components
export const SuccessAlert: React.FC<Omit<AlertProps, 'type'>> = (props) => (
  <Alert {...props} type="success" />
);
export const ErrorAlert: React.FC<Omit<AlertProps, 'type'>> = (props) => (
  <Alert {...props} type="error" />
);
export const WarningAlert: React.FC<Omit<AlertProps, 'type'>> = (props) => (
  <Alert {...props} type="warning" />
);
export const InfoAlert: React.FC<Omit<AlertProps, 'type'>> = (props) => (
  <Alert {...props} type="info" />
);
