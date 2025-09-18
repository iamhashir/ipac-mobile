import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = typeof window !== 'undefined' && !!(window as any).localStorage;

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      (window as any).localStorage.setItem(key, value);
      return;
    } catch {}
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return (window as any).localStorage.getItem(key);
    } catch {}
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      (window as any).localStorage.removeItem(key);
      return;
    } catch {}
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export { isWeb };