import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../utils/AuthContext';
import { PackerSessionProvider } from '../utils/PackerSessionContext';
import './globals.css';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PackerSessionProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(packer)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </PackerSessionProvider>
    </AuthProvider>
  );
}
