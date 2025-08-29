import React, { useEffect } from 'react';
import { Alert as RNAlert } from 'react-native';

interface AlertProps {
  type: 'success' | 'error';
  title: string;
  message?: string;
  onClose?: () => void;
  visible: boolean;
  autoDismiss?: boolean;
  autoDismissTime?: number;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  message,
  onClose,
  visible,
}) => {
  // When visible, show native mobile popup and call onClose when dismissed
  useEffect(() => {
    if (!visible) return;

    const buttons = [
      { text: 'OK', onPress: () => { onClose && onClose(); } },
    ];

    RNAlert.alert(title, message || undefined, buttons, { cancelable: true });
  }, [visible, title, message, onClose]);

  // Render nothing; we use the native alert UI
  return null;
};

// Convenience components
export const SuccessAlert: React.FC<Omit<AlertProps, 'type'>> = (props) => (
  <Alert {...props} type="success" />
);

export const ErrorAlert: React.FC<Omit<AlertProps, 'type'>> = (props) => (
  <Alert {...props} type="error" />
);
