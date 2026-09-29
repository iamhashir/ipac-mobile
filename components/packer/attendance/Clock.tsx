import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

interface ClockProps {
  textClassName?: string;
}

export const Clock: React.FC<ClockProps> = ({ textClassName }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Display only shows minutes — skip re-renders while the minute is unchanged
    const timer = setInterval(() => {
      setCurrentTime((prev) => {
        const now = new Date();
        return prev.getMinutes() === now.getMinutes() &&
          prev.getHours() === now.getHours()
          ? prev
          : now;
      });
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
      hour12: false
    });
  };

  return (
    <View className="flex-row items-center justify-center p-2">
      <Text className={`${textClassName ? textClassName : 'text-black'} text-sm font-medium`}>
        {formatTime(currentTime)}
      </Text>
    </View>
  );
};
