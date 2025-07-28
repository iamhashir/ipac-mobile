import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

export const Clock: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-GB', {
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

  return (
    <View className="flex-row items-center justify-center p-2">
      <Text className="text-black text-sm font-medium">
        {formatTime(currentTime)}
      </Text>
    </View>
  );
};
