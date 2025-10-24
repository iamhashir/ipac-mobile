import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { X, Trash2 } from 'lucide-react-native';
import { supabase } from '../../../utils/api/supabase';

interface DeleteOrderModalProps {
  visible: boolean;
  orderId: string;
  orderName: string;
  onClose: () => void;
  onDeleted: () => void;
}

interface ImpactCounts {
  order_packages: number;
  package_items: number;
  order_package_materials: number;
  order_package_securing: number;
  order_package_services: number;
  task_logs: number;
  task_assignments: number;
  task_packages: number;
  attendance_logs: number;
  order_team_members: number;
  packer_sessions: number;
  transportation: number;
}

const initialCounts: ImpactCounts = {
  order_packages: 0,
  package_items: 0,
  order_package_materials: 0,
  order_package_securing: 0,
  order_package_services: 0,
  task_logs: 0,
  task_assignments: 0,
  task_packages: 0,
  attendance_logs: 0,
  order_team_members: 0,
  packer_sessions: 0,
  transportation: 0,
};

const DeleteOrderModal: React.FC<DeleteOrderModalProps> = ({ visible, orderId, orderName, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [counts, setCounts] = useState<ImpactCounts>(initialCounts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadImpact();
    } else {
      setCounts(initialCounts);
      setError(null);
      setDeleting(false);
    }
  }, [visible, orderId]);

  const countExact = async (from: string, filter: (q: any) => any) => {
    let q = supabase.from(from).select('*', { count: 'exact', head: true });
    q = filter(q);
    const { count, error } = await q;
    if (error) {
      console.warn('Count error for', from, error.message || error);
      return 0;
    }
    return count || 0;
  };

  const loadImpact = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Gather order_packages first
      const { data: pkgRows, error: pkgErr } = await supabase
        .from('order_packages')
        .select('id')
        .eq('order_id', orderId);
      if (pkgErr) throw pkgErr;
      const packageIds = (pkgRows || []).map((r: any) => r.id);

      // 2) Parallel counts
      const [
        packageItems,
        pkgMaterials,
        pkgSecuring,
        pkgServices,
        taskPackagesRows,
        attendance,
        teamMembers,
        sessions,
        transport,
      ] = await Promise.all([
        packageIds.length ? countExact('package_items', (q) => q.in('order_package_id', packageIds)) : Promise.resolve(0),
        packageIds.length ? countExact('order_package_materials', (q) => q.in('order_package_id', packageIds)) : Promise.resolve(0),
        packageIds.length ? countExact('order_package_securing', (q) => q.in('order_package_id', packageIds)) : Promise.resolve(0),
        packageIds.length ? countExact('order_package_services', (q) => q.in('order_package_id', packageIds)) : Promise.resolve(0),
        packageIds.length
          ? (async () => {
              const { data, error } = await supabase
                .from('task_packages')
                .select('task_log_id, order_package_id')
                .in('order_package_id', packageIds);
              if (error) return [] as any[];
              return data || [];
            })()
          : Promise.resolve([] as any[]),
        countExact('attendance_logs', (q) => q.eq('order_id', orderId)),
        countExact('order_team_members', (q) => q.eq('order_id', orderId)),
        countExact('packer_sessions', (q) => q.eq('order_id', orderId)),
        countExact('transportation', (q) => q.eq('order_id', orderId)),
      ]);

      const uniqueTaskLogIds = Array.from(new Set((taskPackagesRows as any[]).map((r: any) => r.task_log_id).filter(Boolean)));

      const [taskLogs, taskAssignments] = await Promise.all([
        uniqueTaskLogIds.length ? countExact('task_logs', (q) => q.in('id', uniqueTaskLogIds)) : Promise.resolve(0),
        uniqueTaskLogIds.length ? countExact('task_assignments', (q) => q.in('task_id', uniqueTaskLogIds)) : Promise.resolve(0),
      ]);

      setCounts({
        order_packages: packageIds.length,
        package_items: packageItems as number,
        order_package_materials: pkgMaterials as number,
        order_package_securing: pkgSecuring as number,
        order_package_services: pkgServices as number,
        task_packages: (taskPackagesRows as any[]).length,
        task_logs: taskLogs as number,
        task_assignments: taskAssignments as number,
        attendance_logs: attendance as number,
        order_team_members: teamMembers as number,
        packer_sessions: sessions as number,
        transportation: transport as number,
      });
    } catch (e: any) {
      console.error('Failed to load deletion impact', e);
      setError('Failed to load linked records. You can still proceed to delete, but the summary may be incomplete.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_order_cascade', { order_uuid: orderId });
      if (error) throw error;
      Alert.alert('Deleted', 'Order deleted successfully');
      onDeleted();
      onClose();
    } catch (e: any) {
      console.error('Delete order failed:', e);
      const msg = e?.message || e?.details || e?.hint || 'Failed to delete order';
      Alert.alert('Error', String(msg));
    } finally {
      setDeleting(false);
    }
  };

  const rows: { label: string; value: number }[] = [
    { label: 'Boxes (order_packages)', value: counts.order_packages },
    { label: 'Package items', value: counts.package_items },
    { label: 'Package materials', value: counts.order_package_materials },
    { label: 'Package securing', value: counts.order_package_securing },
    { label: 'Package services', value: counts.order_package_services },
    { label: 'Task-package links', value: counts.task_packages },
    { label: 'Task logs', value: counts.task_logs },
    { label: 'Task assignments', value: counts.task_assignments },
    { label: 'Attendance logs', value: counts.attendance_logs },
    { label: 'Team members', value: counts.order_team_members },
    { label: 'Packer sessions', value: counts.packer_sessions },
    { label: 'Transportation records', value: counts.transportation },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/50 justify-center items-center p-4" activeOpacity={1} onPress={onClose}>
        <TouchableOpacity className="bg-white rounded-xl w-full max-w-2xl max-h-5/6" activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View className="flex-row justify-between items-center p-6 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">Delete Order</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-6">
            <Text className="text-base text-gray-800 mb-2">You are about to permanently delete:</Text>
            <Text className="text-lg font-semibold text-gray-900 mb-4">{orderName}</Text>

            <View className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <Text className="text-amber-800 text-sm">
                This action cannot be undone. All linked records listed below will be deleted.
              </Text>
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator />
                <Text className="ml-3 text-gray-600">Loading linked records…</Text>
              </View>
            ) : (
              <View>
                {rows.map((r, idx) => (
                  <View key={idx} className="flex-row justify-between items-center py-2 border-b border-gray-100">
                    <Text className="text-gray-700">{r.label}</Text>
                    <Text className="text-gray-900 font-semibold">{r.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View className="flex-row space-x-3 p-6 border-t border-gray-200">
            <TouchableOpacity onPress={onClose} disabled={deleting} className="flex-1 bg-gray-100 py-3 rounded-lg">
              <Text className="text-gray-700 font-medium text-center">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleting || loading}
              className={`flex-1 py-3 rounded-lg ${deleting || loading ? 'bg-red-300' : 'bg-red-600'}`}
            >
              <View className="flex-row justify-center items-center">
                <Trash2 size={18} color="#fff" />
                <Text className="text-white font-medium text-center ml-2">{deleting ? 'Deleting…' : 'Delete Order'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default DeleteOrderModal;