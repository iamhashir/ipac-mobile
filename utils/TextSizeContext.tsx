import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TextSizeOption = 'small' | 'medium' | 'large';
export const TEXT_SIZE_KEY = 'packer_text_size';

interface TextSizeContextValue {
  size: TextSizeOption;
  setSize: (size: TextSizeOption) => void;
}

const TextSizeContext = createContext<TextSizeContextValue | undefined>(undefined);

const SCALE_MAP: Record<TextSizeOption, number> = {
  // Make differences clearly visible across the app (web + native)
  small: 0.9,
  medium: 1.0,
  large: 1.3,
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

    // Apply global font scaling via Text.defaultProps (native/mobile) and CSS override (web)
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

    // Apply same default scaling to TextInput so inputs scale too
    const RNTextInput: any = TextInput as any;
    RNTextInput.defaultProps = RNTextInput.defaultProps || {};
    const inputExisting = RNTextInput.defaultProps.style;
    const inputBaseArray = Array.isArray(inputExisting)
      ? inputExisting
      : inputExisting
      ? [inputExisting]
      : [];
    const inputWithoutPrev = inputBaseArray.filter((s: any) => !(s && s.__textSizeScale));
    RNTextInput.defaultProps.style = [...inputWithoutPrev, scaleStyle];
    RNTextInput.defaultProps.allowFontScaling = true;

    // Web-only: set a data attribute on <html> so globals.css can override RN Web class font-sizes
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-textsize', size);
    }
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
