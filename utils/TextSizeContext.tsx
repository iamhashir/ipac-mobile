import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TextSizeOption = 'small' | 'medium' | 'large';
export const TEXT_SIZE_KEY = 'packer_text_size';

interface TextSizeContextValue {
  size: TextSizeOption;
  setSize: (size: TextSizeOption) => void;
}

const TextSizeContext = createContext<TextSizeContextValue | undefined>(undefined);

const SCALE_MAP: Record<TextSizeOption, number> = {
  small: 0.92,
  medium: 1.0,
  large: 1.12,
};

export const TextSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [size, setSizeState] = useState<TextSizeOption>('medium');
  const [hydrated, setHydrated] = useState(false);

  // hydrate from storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TEXT_SIZE_KEY);
        if (stored === 'small' || stored === 'medium' || stored === 'large') {
          setSizeState(stored);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // apply global scaling and persist on change
  useEffect(() => {
    if (!hydrated) return;
    // Persist
    AsyncStorage.setItem(TEXT_SIZE_KEY, size).catch(() => {});

    // Apply global font scaling via Text.defaultProps
    // We keep any prior default style, and append a transform scale that approximates the preference.
    // Note: This scales text visually across the app without touching each component.
    const RNText: any = Text as any;
    RNText.defaultProps = RNText.defaultProps || {};
    const existingStyle = RNText.defaultProps.style;

    const baseStyleArray = Array.isArray(existingStyle)
      ? existingStyle
      : existingStyle
      ? [existingStyle]
      : [];

    // Remove any previous scale we added (identified by a marker property)
    const withoutPrevScale = baseStyleArray.filter((s: any) => !(s && s.__textSizeScale));

    const scale = SCALE_MAP[size];
    const scaleStyle = { transform: [{ scale }], __textSizeScale: true } as any;

    RNText.defaultProps.style = [...withoutPrevScale, scaleStyle];
    RNText.defaultProps.allowFontScaling = true;
  }, [size, hydrated]);

  const value = useMemo(() => ({ size, setSize: setSizeState }), [size]);

  return (
    <TextSizeContext.Provider value={value}>
      {children}
    </TextSizeContext.Provider>
  );
};

export const useTextSize = (): TextSizeContextValue => {
  const ctx = useContext(TextSizeContext);
  if (!ctx) throw new Error('useTextSize must be used within a TextSizeProvider');
  return ctx;
};
