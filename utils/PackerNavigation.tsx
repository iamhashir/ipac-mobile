import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { usePackerSession } from './PackerSessionContext';

export const usePackerNavigation = () => {
  const router = useRouter();
  const { session, canAccessAttendance, canAccessPackaging } = usePackerSession();

  const navigateToStep = (step: 'dashboard' | 'attendance' | 'packing-report') => {
    switch (step) {
      case 'dashboard':
        // Always allow going back to dashboard
        router.push('/(packer)/dashboard');
        break;

      case 'attendance':
        if (!canAccessAttendance()) {
          Alert.alert(
            'Access Denied',
            'You must first select a team and project before accessing attendance.',
            [
              {
                text: 'Go to Dashboard',
                onPress: () => router.push('/(packer)/dashboard'),
              },
              { text: 'OK' },
            ]
          );
          return false;
        }
        router.push('/(packer)/attendance');
        break;

      case 'packing-report':
        if (!canAccessPackaging()) {
          let message = 'You must complete the following steps first:\n';
          
          if (!canAccessAttendance()) {
            message += '• Select a team and project\n';
          }
          if (!session?.attendance_completed) {
            message += '• Complete attendance logging\n';
          }

          Alert.alert(
            'Access Denied',
            message.trim(),
            [
              {
                text: 'Go Back',
                onPress: () => {
                  if (canAccessAttendance()) {
                    router.push('/(packer)/attendance');
                  } else {
                    router.push('/(packer)/dashboard');
                  }
                },
              },
              { text: 'OK' },
            ]
          );
          return false;
        }
        router.push('/(packer)/packing-report');
        break;

      default:
        console.warn('Unknown navigation step:', step);
        return false;
    }
    return true;
  };

  const getNextStep = (): 'attendance' | 'packing-report' | null => {
    if (!canAccessAttendance()) {
      return null; // Stay on dashboard
    }
    if (!session?.attendance_completed) {
      return 'attendance';
    }
    return 'packing-report';
  };

  const canNavigateToStep = (step: 'dashboard' | 'attendance' | 'packing-report'): boolean => {
    switch (step) {
      case 'dashboard':
        return true; // Always can go back to dashboard
      case 'attendance':
        return canAccessAttendance();
      case 'packing-report':
        return canAccessPackaging();
      default:
        return false;
    }
  };

  const getCurrentStepInfo = () => {
    if (!session) {
      return {
        currentStep: 'dashboard',
        stepNumber: 1,
        totalSteps: 3,
        stepName: 'Team Selection',
        description: 'Select your team and project',
      };
    }

    if (!session.attendance_completed) {
      return {
        currentStep: 'attendance',
        stepNumber: 2,
        totalSteps: 3,
        stepName: 'Attendance',
        description: 'Log attendance and work times',
      };
    }

    return {
      currentStep: 'packing-report',
      stepNumber: 3,
      totalSteps: 3,
      stepName: 'Packing Report',
      description: 'Package and finalize work',
    };
  };

  return {
    navigateToStep,
    getNextStep,
    canNavigateToStep,
    getCurrentStepInfo,
    session,
  };
};

// Progress indicators component
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  description: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  stepName,
  description,
}) => {
  return (
    <View className="bg-white p-4 mx-4 rounded-lg shadow-sm border border-gray-200 mb-4">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-lg font-semibold text-gray-800">{stepName}</Text>
        <Text className="text-sm text-gray-500">
          Step {currentStep} of {totalSteps}
        </Text>
      </View>
      <Text className="text-gray-600 mb-3">{description}</Text>
      
      {/* Progress bar */}
      <View className="flex-row space-x-2">
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            className={`flex-1 h-2 rounded-full ${
              index < currentStep
                ? 'bg-green-500'
                : index === currentStep - 1
                ? 'bg-blue-500'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </View>
    </View>
  );
};

// Navigation buttons component
interface NavigationButtonsProps {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
  showNext?: boolean;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  onBack,
  onNext,
  backLabel = 'Back',
  nextLabel = 'Next',
  nextDisabled = false,
  showBack = true,
  showNext = true,
}) => {
  return (
    <View className="flex-row justify-between items-center p-4 bg-white border-t border-gray-200">
      {showBack ? (
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          className="px-6 py-3 bg-gray-500 rounded-lg"
        >
          <Text className="text-white font-medium">{backLabel}</Text>
        </TouchableOpacity>
      ) : (
        <View />
      )}
      
      {showNext && (
        <TouchableOpacity
          onPress={onNext}
          activeOpacity={nextDisabled ? 1 : 0.7}
          disabled={nextDisabled}
          className={`px-6 py-3 rounded-lg ${
            nextDisabled
              ? 'bg-gray-300'
              : 'bg-blue-500'
          }`}
        >
          <Text className={`font-medium ${
            nextDisabled ? 'text-gray-500' : 'text-white'
          }`}>{nextLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
