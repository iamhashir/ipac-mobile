import React, { useState } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { db } from '../../../../../utils/api/supabase';
import { useAuth } from '../../../../../utils/AuthContext';
import { usePackerSession } from '../../../../../utils/PackerSessionContext';
import { useRouter } from 'expo-router';
import { ConfirmModal } from '../../../../ui/ConfirmModal';
import { ErrorAlert, InfoAlert } from '../../../../ui/Alert';
import { ActiveTaskSummary, buildActiveTaskSummaries, formatBoxList, formatPackerList } from '../../../../../utils/tasks/activeTaskSummaries';

interface RemoveSelfButtonProps {
  orderId: string;
  orderName?: string;
  onSuccess?: () => void;
  buttonClass?: string;
}

export default function RemoveSelfButton({ 
  orderId, 
  orderName = 'this order',
  onSuccess,
  buttonClass = 'px-4 py-2 bg-red-500 rounded'
}: RemoveSelfButtonProps) {
  const { profile } = useAuth() as any;
  const router = useRouter();
  const { clearSession } = usePackerSession();
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorAlert, setErrorAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});
  const [infoAlert, setInfoAlert] = useState<{visible: boolean, title: string, message?: string}>({visible: false, title: ''});
  const [loading, setLoading] = useState(false);
  const [activeTasks, setActiveTasks] = useState<ActiveTaskSummary[]>([]);

  const prepareTaskSummary = async () => {
    if (!profile?.id) return;

    const selfName = profile?.full_name || profile?.username || 'You';
    const nameLookup: Record<string, string> = { [profile.id]: selfName };

    try {
      const { data: tasksData, error } = await db.getActiveTasksForPackers(orderId, [profile.id]);
      if (error) {
        console.warn('Error loading tasks before removal:', error);
        setActiveTasks([]);
        return;
      }

      setActiveTasks(buildActiveTaskSummaries(tasksData || [], nameLookup));
    } catch (taskError) {
      console.error('Unexpected task summary error:', taskError);
      setActiveTasks([]);
    }
  };

  const checkRemovalEligibility = async () => {
    if (!profile?.id) return;

    try {
      await prepareTaskSummary();
      setShowConfirm(true);
    } catch (error) {
      console.error('Error checking removal eligibility:', error);
      setErrorAlert({visible: true, title: 'Error', message: 'An unexpected error occurred'});
    }
  };

  const handleRemoveSelf = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data, error } = await db.removeSelfFromOrder(orderId, profile.id);
      
      if (error) {
        setErrorAlert({visible: true, title: 'Failed', message: 'Failed to remove yourself from the order'});
        return;
      }

      // Check the response
      if (data && !data.success) {
        setErrorAlert({visible: true, title: 'Failed', message: data.message || 'Failed to remove yourself'});
        return;
      }

      // Success
  setInfoAlert({visible: true, title: 'Success', message: 'You have been removed from the order'});
  clearSession();
      
      // Call success callback or navigate
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000);
      } else {
        setTimeout(() => router.replace('/(packer)/dashboard'), 1000);
      }
    } catch (error) {
      console.error('Error removing self:', error);
      setErrorAlert({visible: true, title: 'Error', message: 'An unexpected error occurred'});
    } finally {
      setLoading(false);
      setShowConfirm(false);
      setActiveTasks([]);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={checkRemovalEligibility}
        disabled={loading}
        className={buttonClass}
      >
        <Text className="text-white font-semibold">
          {loading ? 'Removing...' : 'Leave Order'}
        </Text>
      </TouchableOpacity>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={showConfirm}
        title="Leave Order"
        description={`Are you sure you want to remove yourself from ${orderName}? Any in-progress tasks listed below will be marked completed.`}
        confirmText={loading ? 'Removing...' : 'Leave'}
        cancelText="Cancel"
        variant="danger"
        loading={loading}
        onCancel={() => {
          if (loading) return;
          setShowConfirm(false);
          setActiveTasks([]);
        }}
        onConfirm={handleRemoveSelf}
      >
        {activeTasks.length === 0 ? (
          <Text className="text-gray-700">No active tasks will be updated.</Text>
        ) : (
          activeTasks.map((task, index) => (
            <View key={`${task.task}-${index}`} className="mb-3 p-2 bg-gray-50 rounded">
              <Text className="text-gray-900 font-semibold">{task.task}</Text>
              <Text className="text-gray-700 text-sm mt-1">
                <Text className="font-medium">Packers:</Text> {formatPackerList(task.packerNames)}
              </Text>
              <Text className="text-gray-700 text-sm">
                <Text className="font-medium">Boxes:</Text> {formatBoxList(task.boxes)}
              </Text>
            </View>
          ))
        )}
      </ConfirmModal>

      {/* Error Alert */}
      <ErrorAlert
        visible={errorAlert.visible}
        title={errorAlert.title}
        message={errorAlert.message}
        onClose={() => setErrorAlert({visible: false, title: ''})}
        autoDismiss={true}
      />

      {/* Info Alert */}
      <InfoAlert
        visible={infoAlert.visible}
        title={infoAlert.title}
        message={infoAlert.message}
        onClose={() => setInfoAlert({visible: false, title: ''})}
        autoDismiss={true}
      />
    </>
  );
}
