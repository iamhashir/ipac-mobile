import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '../../utils/cn';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info';

interface BadgeProps {
  className?: string;
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, { container: string; text: string }> = {
  default: { container: 'bg-gray-100 border border-gray-300', text: 'text-gray-800' },
  secondary: { container: 'bg-gray-200', text: 'text-gray-800' },
  outline: { container: 'border border-gray-300', text: 'text-gray-800' },
  success: { container: 'bg-green-50 border border-green-300', text: 'text-green-800' },
  warning: { container: 'bg-amber-50 border border-amber-300', text: 'text-amber-800' },
  destructive: { container: 'bg-red-50 border border-red-300', text: 'text-red-800' },
  info: { container: 'bg-blue-50 border border-blue-300', text: 'text-blue-800' },
};

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', children }) => {
  const v = variantClasses[variant];
  return (
    <View className={cn('px-2 py-1 rounded-full', v.container, className)}>
      <Text className={cn('text-xs font-medium', v.text)}>{children}</Text>
    </View>
  );
};

export default Badge;