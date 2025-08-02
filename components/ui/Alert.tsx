import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CheckCircle, XCircle, X } from 'lucide-react-native';

interface AlertProps {
  type: 'success' | 'error';
  title: string;
  message?: string;
  onClose?: () => void;
  visible: boolean;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  message,
  onClose,
  visible
}) => {
  if (!visible) return null;

  const isSuccess = type === 'success';
  const bgColor = isSuccess ? 'bg-green-50' : 'bg-red-50';
  const borderColor = isSuccess ? 'border-green-200' : 'border-red-200';
  const textColor = isSuccess ? 'text-green-800' : 'text-red-800';
  const iconColor = isSuccess ? '#16A34A' : '#DC2626';

  return (
    <View className={`${bgColor} ${borderColor} border rounded-lg p-4 mb-4`}>
      <View className="flex-row items-start">
        <View className="flex-shrink-0">
          {isSuccess ? (
            <CheckCircle size={20} color={iconColor} />
          ) : (
            <XCircle size={20} color={iconColor} />
          )}
        </View>
        
        <View className="ml-3 flex-1">
          <Text className={`${textColor} font-medium text-sm`}>
            {title}
          </Text>
          {message && (
            <Text className={`${textColor} text-sm mt-1 opacity-80`}>
              {message}
            </Text>
          )}
        </View>
        
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            className="flex-shrink-0 ml-2"
          >
            <X size={16} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
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
