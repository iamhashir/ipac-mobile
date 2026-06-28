import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

export const IMMERSIVE_KEY = 'packer_immersive_mode';

interface ImmersiveContextValue {
  /** true = hide the system navigation bar so the app uses the full screen. */
  immersive: boolean;
  setImmersive: (value: boolean) => void;
  hydrated: boolean;
}

const ImmersiveContext = createContext<ImmersiveContextValue | undefined>(
  undefined,
);

/** Hide/show the Android system navigation bar. No-op on other platforms. */
const applyNavBar = async (immersive: boolean) => {
  if (Platform.OS !== 'android') return;
  try {
    if (immersive) {
      // Sticky immersive: bar stays hidden; a swipe from the edge reveals it briefly.
      await NavigationBar.setBehaviorAsync('overlay-swipe');
      await NavigationBar.setVisibilityAsync('hidden');
    } else {
      await NavigationBar.setVisibilityAsync('visible');
    }
  } catch {
    // Ignore — older Android / edge-to-edge can reject some calls; not fatal.
  }
};

export const ImmersiveProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Default ON: dismiss the system bar so the whole screen is usable for the app.
  const [immersive, setImmersiveState] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the stored preference.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(IMMERSIVE_KEY);
        if (stored === 'true' || stored === 'false') {
          setImmersiveState(stored === 'true');
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist + apply on change.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(IMMERSIVE_KEY, String(immersive)).catch(() => {});
    applyNavBar(immersive);
  }, [immersive, hydrated]);

  // Re-apply when the app returns to the foreground (the bar can creep back after
  // keyboard/system interactions), so immersive mode stays sticky.
  useEffect(() => {
    if (!hydrated) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyNavBar(immersive);
    });
    return () => sub.remove();
  }, [immersive, hydrated]);

  const value = useMemo(
    () => ({ immersive, setImmersive: setImmersiveState, hydrated }),
    [immersive, hydrated],
  );

  return (
    <ImmersiveContext.Provider value={value}>
      {children}
    </ImmersiveContext.Provider>
  );
};

export const useImmersive = (): ImmersiveContextValue => {
  const ctx = useContext(ImmersiveContext);
  if (!ctx)
    throw new Error('useImmersive must be used within an ImmersiveProvider');
  return ctx;
};
