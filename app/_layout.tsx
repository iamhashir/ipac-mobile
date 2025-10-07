import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../utils/AuthContext';
import { PackerSessionProvider } from '../utils/PackerSessionContext';
import { TextSizeProvider, useTextSize } from '../utils/TextSizeContext';
import { Text, View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import './globals.css';

function AppStack() {
  // Re-mount the navigator when text size changes so all Text nodes pick up new defaults
  const { size } = useTextSize();
  return (
    <>
      <StatusBar style="auto" />
      <Stack key={size} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(packer)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Load Calibri fonts from local folder
  const [fontsLoaded] = useFonts({
    'Calibri-Regular': require('../assets/fonts/calibri-regular.ttf'),
    'Calibri-Bold': require('../assets/fonts/calibri-bold.ttf'),
    'Calibri-Italic': require('../assets/fonts/calibri-italic.ttf'),
    'Calibri-BoldItalic': require('../assets/fonts/calibri-bold-italic.ttf'),
  });

  // Silence noisy dev-only warnings on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      LogBox.ignoreLogs([
        'useNativeDriver is not supported',
        // Reduce noise on web: RN Web warns when stray text nodes appear under View
        'Unexpected text node',
        'A text node cannot be a child of a <View>'
      ]);
    }
  }, []);

  // Set default Text font to Calibri-Regular once fonts are loaded
  useEffect(() => {
    if (!fontsLoaded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RNText: any = Text as any;
    RNText.defaultProps = RNText.defaultProps || {};
    const existing = RNText.defaultProps.style;
    RNText.defaultProps.style = Array.isArray(existing)
      ? [...existing, { fontFamily: 'Calibri-Regular' }]
      : existing
        ? [existing, { fontFamily: 'Calibri-Regular' }]
        : { fontFamily: 'Calibri-Regular' };
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Keep it simple; avoid flicker before font loads
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-2 text-gray-600">Loading fonts...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <TextSizeProvider>
        <PackerSessionProvider>
          <AppStack />
        </PackerSessionProvider>
      </TextSizeProvider>
    </AuthProvider>
  );
}
