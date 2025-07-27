import React from 'react';
import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-gray-50">
      <Text className="text-2xl font-bold text-gray-900 mb-4">
        Page Not Found
      </Text>
      <Text className="text-gray-600 mb-8">
        The page you're looking for doesn't exist.
      </Text>
      <Link href="/" className="bg-primary-500 px-6 py-3 rounded-lg">
        <Text className="text-white font-semibold">Go Home</Text>
      </Link>
    </View>
  );
}
