import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../../utils/api/supabase';
import OrderSecuringSection from '../../../components/packing/OrderSecuringSection';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

interface OrderPkg { id: string; package_number: number | null; description: string | null; status: string; }

export default function OrderDetailsPage() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [packages, setPackages] = useState<OrderPkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allowOriginalEdits, setAllowOriginalEdits] = useState(false);

  useEffect(() => { if (orderId) load(); }, [orderId]);

  const load = async () => {
    try {
      setLoading(true);
      const { data: ord } = await db.getOrderById(orderId);
      setOrder(ord);
      const { data: pkgs } = await db.getOrderPackages(orderId);
      const list = (pkgs || []).sort((a: any, b: any) => (a.package_number || 0) - (b.package_number || 0));
      setPackages(list);
      // Ensure empty final securing rows for all packages (behind the scenes)
      for (const p of list) {
        try { await db.ensureFinalSecuringForPackage(p.id); } catch (_) {}
      }
      // If order not pending, require confirmation to edit original
      setNeedsConfirm(ord?.production_status && ord.production_status !== 'pending');
      setAllowOriginalEdits(!(ord?.production_status && ord.production_status !== 'pending'));
    } catch (e) {
      Alert.alert('Error', 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 py-4 bg-white border-b border-gray-200 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900">Order Details</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-gray-100 px-3 py-2 rounded-lg">
          <Text className="text-gray-700">Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {order && (
          <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <Text className="text-xl font-semibold text-gray-900">{order.order_name}</Text>
            <Text className="text-sm text-gray-600">Client: {order.clients?.name || '—'}</Text>
            <Text className="text-xs text-gray-500 mt-1">Commercial: {order.commercial_status} • Production: {order.production_status}</Text>
          </View>
        )}

        {needsConfirm && !allowOriginalEdits && (
          <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <Text className="text-yellow-800">
              This order is already started. Editing original values may affect packers’ work. You can still proceed after confirmation.
            </Text>
            <TouchableOpacity onPress={() => setConfirmOpen(true)} className="mt-2 bg-yellow-600 px-3 py-2 rounded">
              <Text className="text-white font-medium">Enable Original Editing</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Boxes */}
        <View className="mb-3">
          <Text className="text-lg font-semibold text-gray-900 mb-2">Boxes</Text>
          {packages.map((p) => (
            <View key={p.id} className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
              <Text className="text-base font-semibold text-gray-900">Box #{p.package_number}</Text>
              {p.description ? (
                <Text className="text-xs text-gray-600 mb-2">{p.description}</Text>
              ) : null}
              {/* Securing section: admin edits ORIGINAL fields inline */}
              <OrderSecuringSection orderPackageId={p.id} editTarget="original" editable={allowOriginalEdits} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Confirmation modal for enabling original edits after start */}
      <ConfirmModal
        visible={confirmOpen}
        title="Enable Editing Original Values"
        description="Packers have started this order. Changing original values may cause inconsistencies. Proceed?"
        confirmText="Allow Editing"
        cancelText="Cancel"
        variant="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); setAllowOriginalEdits(true); }}
      />
    </SafeAreaView>
  );
}
