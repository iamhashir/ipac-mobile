import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const toastConfig = {
  success: {
    bgColor: '#dcfce7',
    borderColor: '#22c55e',
    textColor: '#166534',
    Icon: CheckCircle,
  },
  error: {
    bgColor: '#fef2f2',
    borderColor: '#ef4444',
    textColor: '#991b1b',
    Icon: XCircle,
  },
  warning: {
    bgColor: '#fefce8',
    borderColor: '#eab308',
    textColor: '#854d0e',
    Icon: AlertTriangle,
  },
  info: {
    bgColor: '#eff6ff',
    borderColor: '#3b82f6',
    textColor: '#1e40af',
    Icon: Info,
  },
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(50)).current;

  const config = toastConfig[toast.type];
  const { Icon } = config;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const duration = toast.duration ?? 3000;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss(toast.id);
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Icon size={20} color={config.textColor} />
      <Text style={[styles.toastText, { color: config.textColor }]} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
};

// Toast context and provider
interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export const useToast = (): ToastContextType => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const value: ToastContextType = React.useMemo(
    () => ({
      showToast,
      success: (message: string, duration?: number) => showToast('success', message, duration),
      error: (message: string, duration?: number) => showToast('error', message, duration),
      warning: (message: string, duration?: number) => showToast('warning', message, duration),
      info: (message: string, duration?: number) => showToast('info', message, duration),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container - positioned absolutely, doesn't block interactions */}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    alignItems: 'flex-start',
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  toastItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    maxWidth: width - 32,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  toastText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});

export default ToastProvider;
