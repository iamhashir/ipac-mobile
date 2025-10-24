import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '../../../utils/cn';

interface BaseProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: BaseProps) {
  return (
    <View className={cn('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      {children}
    </View>
  );
}

export function CardHeader({ className, children }: BaseProps) {
  return <View className={cn('px-4 py-3 border-b border-gray-200', className)}>{children}</View>;
}

export function CardTitle({ className, children }: BaseProps) {
  return <Text className={cn('text-lg font-semibold text-gray-900', className)}>{children}</Text>;
}

export function CardDescription({ className, children }: BaseProps) {
  return <Text className={cn('text-sm text-gray-600', className)}>{children}</Text>;
}

export function CardContent({ className, children }: BaseProps) {
  return <View className={cn('px-4 py-3', className)}>{children}</View>;
}

export function CardFooter({ className, children }: BaseProps) {
  return <View className={cn('px-4 py-3 border-t border-gray-200', className)}>{children}</View>;
}

export default Card;