import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Trash2 } from 'lucide-react-native';
import { db } from '../../../utils/api/supabase';
import OrderSecuringSection from '../../../components/packer/packing-list/section_05_manufacturing/OrderSecuringSection';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import PackageInfoFields, { PackageInfoValue } from '../../../components/admin/orders/PackageInfoFields';
import OrderPackingInfo, { BoxInfoDetails } from '../../../components/packer/packing-list/section_01_packing_info/order_packing_info';
import OrderPackingItems from '../../../components/packer/packing-list/section_02_packing_items/order_packing_items';
import PackageForm from '../../../components/admin/orders/PackageForm';
import AccessoriesSection from '../../../components/packer/packing-list/section_09_accessories/AccessoriesSection';
import VacuumPackingSection from '../../../components/packer/packing-list/section_08_vacuum/VacuumPackingSection';
import GasPackingSection from '../../../components/packer/packing-list/section_07_gas/GasPackingSection';
import DeletePackageModal from '../../../components/admin/orders/DeletePackageModal';
import AttendanceMonitor from '../../../components/admin/orders/AttendanceMonitor';
import ActivityMonitor from '../../../components/admin/orders/ActivityMonitor';

interface OrderPkg { id: string; package_number: number | null; description: string | null; status: string; original_pkg_info?: string | null; final_pkg_info?: string | null; }

export default function OrderDetailsPage() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [packages, setPackages] = useState<OrderPkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allowOriginalEdits, setAllowOriginalEdits] = useState(false);
  const [infoDrafts, setInfoDrafts] = useState<Record<string, PackageInfoValue>>({});
  const [newItem, setNewItem] = useState<Record<string, { designation: string; qty: string }>>({});
  const [showAddBox, setShowAddBox] = useState(false);
  const [packTypeHasVacuum, setPackTypeHasVacuum] = useState<Record<string, boolean>>({});
  const [packTypeHasGas, setPackTypeHasGas] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; packageId: string; packageNumber: number | null }>({ visible: false, packageId: '', packageNumber: null });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => { if (orderId) load(); }, [orderId]);

  const handleResetPackerData = async () => {
    try {
      const { error } = await db.resetPackerData(orderId);
      if (error) {
        console.warn('Failed to reset packer data:', error);
      }
      setResetConfirmOpen(false);
      await load();
    } catch (e) {
      console.error('Unexpected error while resetting packer data:', e);
      setResetConfirmOpen(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const { data: ord } = await db.getOrderById(orderId);
      setOrder(ord);
      const { data: pkgs } = await db.getOrderPackages(orderId);
      const list = (pkgs || []).sort((a: any, b: any) => (a.package_number || 0) - (b.package_number || 0));
      setPackages(list);

      // Set Box #1 as default active tab if not already set
      if (list.length > 0 && !activeTab) {
        setActiveTab(list[0].id);
      }

      // Ensure securing rows exist for original/final for all packages
      for (const p of list) {
        try { await db.ensureOriginalSecuringForPackage(p.id); } catch (_) {}
        try { await db.ensureFinalSecuringForPackage(p.id); } catch (_) {}
      }

      // Load package info for originals
      const originalIds = list.map((p: any) => p.original_pkg_info).filter(Boolean);
      const { data: infos } = await db.getPackageInfosByIds(originalIds);
      const drafts: Record<string, PackageInfoValue> = {} as any;
      (list || []).forEach((p: any) => {
        const rec = (infos || []).find((i: any) => i.id === p.original_pkg_info) as any;
        drafts[p.id] = {
          description: undefined,
          quantity: rec?.quantity ?? null,
          center_of_gravity: rec?.center_of_gravity ?? null,
          box_type_id: rec?.box_type_id ?? null,
          packing_type_id: rec?.packing_type_id ?? null,
          tare: rec?.tare ?? null,
          net_weight: rec?.net_weight ?? null,
          gross_weight: rec?.gross_weight ?? null,
          internal_length: rec?.internal_length ?? null,
          internal_width: rec?.internal_width ?? null,
          internal_height: rec?.internal_height ?? null,
          external_length: rec?.external_length ?? null,
          external_width: rec?.external_width ?? null,
          external_height: rec?.external_height ?? null,
        };
      });
      setInfoDrafts(drafts);

      // Determine which packing types include vacuum protection
      const packTypeIds = Array.from(new Set((infos || []).map((i: any) => i?.packing_type_id).filter(Boolean)));
      if (packTypeIds.length) {
        const { data: types } = await db.getPackingTypesByIds(packTypeIds);
        const vacMap: Record<string, boolean> = {};
        const gasMap: Record<string, boolean> = {};
        (types || []).forEach((t: any) => { vacMap[t.id] = !!t.includes_vacuum_protection; gasMap[t.id] = !!t.includes_gas_protection; });
        setPackTypeHasVacuum(vacMap);
        setPackTypeHasGas(gasMap);
      } else {
        setPackTypeHasVacuum({});
        setPackTypeHasGas({});
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
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => setResetConfirmOpen(true)} className="bg-red-600 px-3 py-2 rounded-lg">
            <Text className="text-white">Reset Packer Data</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAddBox(true)} className="bg-primary-600 px-3 py-2 rounded-lg">
            <Text className="text-white">Add Box</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} className="bg-gray-100 px-3 py-2 rounded-lg">
            <Text className="text-gray-700">Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {order && (
          <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <Text className="text-xl font-semibold text-gray-900">{order.order_name}</Text>
            <Text className="text-sm text-gray-600">Client: {order.clients?.name || '—'}</Text>
            <Text className="text-xs text-gray-500 mt-1">Commercial: {order.commercial_status} • Production: {order.production_status}</Text>
          </View>
        )}

        {/* Attendance Monitor Section */}
        {orderId && (
          <AttendanceMonitor orderId={orderId as string} />
        )}

        {/* Activity Monitor Section */}
        {orderId && packages.length > 0 && (
          <ActivityMonitor orderId={orderId as string} orderPackages={packages} />
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

        {/* Boxes - Tabs Layout */}
        <View className="mb-3">
          {/* Tab buttons */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-0 flex-row">
            {packages.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setActiveTab(activeTab === p.id ? null : p.id)}
                className={`px-4 py-2.5 mr-1.5 rounded-t-lg border-b-2 ${
                  activeTab === p.id
                    ? 'bg-blue-50 border-blue-600'
                    : 'bg-gray-50 border-gray-300'
                }`}
              >
                <Text className={`font-medium text-sm ${
                  activeTab === p.id ? 'text-blue-700' : 'text-gray-700'
                }`}>
                  Box #{p.package_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tab content */}
          {packages.map((p) => (
            activeTab === p.id && (
              <View key={`content-${p.id}`} className="bg-white rounded-b-lg border-l border-r border-b border-gray-200 p-4">
                {/* Header with delete button */}
                <View className="flex-row items-center justify-between mb-3">
                  <View>
                    <Text className="text-base font-semibold text-gray-900">Box #{p.package_number}</Text>
                    {p.description ? (
                      <Text className="text-xs text-gray-600 mt-0.5">{p.description}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => setDeleteModal({ visible: true, packageId: p.id, packageNumber: p.package_number })}
                    className="p-2 bg-red-50 rounded-lg"
                  >
                    <Trash2 size={18} color="#dc2626" />
                  </TouchableOpacity>
                </View>

              {/* Package Info (Original) - Using Packer Portal Style */}
              <View className="mt-2">
                {(() => {
                  const draft = infoDrafts[p.id] || {};
                  const originalDetails: BoxInfoDetails = {
                    quantity: draft.quantity ?? null,
                    sei: null, // Will be populated from packing type
                    boxType: null, // Will be populated from material
                    tare: draft.tare ?? null,
                    netWeight: draft.net_weight ?? null,
                    grossWeight: draft.gross_weight ?? null,
                    centerOfGravity: draft.center_of_gravity ?? null,
                  };
                  return (
                    <OrderPackingInfo
                      original={originalDetails}
                      final={null}
                      originalInfoId={(p as any).original_pkg_info}
                      finalInfoId={null}
                      orderPackageId={p.id}
                      originalBoxTypeId={draft.box_type_id || null}
                      finalBoxTypeId={null}
                      originalPackingTypeId={draft.packing_type_id || null}
                      finalPackingTypeId={null}
                      editTarget="original"
                      editable={allowOriginalEdits}
                    />
                  );
                })()}
              </View>

              {/* Package Items (add) */}
              <View className="mt-2.5 p-2.5 border border-green-200 rounded-lg bg-green-50">
                <Text className="text-green-800 font-semibold text-sm mb-2">Package Items</Text>
                <View className="flex-row gap-2 mb-2">
                  <View className="flex-1 bg-white border border-gray-300 rounded-lg">
                    <Text className="text-xs text-gray-600 px-2 pt-1">Designation</Text>
                    <View className="px-2 pb-2">
<TextInput value={(newItem[p.id]?.designation) || ''} onChangeText={(t) => setNewItem(prev => ({ ...prev, [p.id]: { designation: t, qty: prev[p.id]?.qty || '' } }))} placeholder="e.g., Motor assembly" className="border-0 px-0 py-0" />
                    </View>
                  </View>
                  <View className="w-28 bg-white border border-gray-300 rounded-lg">
                    <Text className="text-xs text-gray-600 px-2 pt-1">Qty</Text>
                    <View className="px-2 pb-2">
<TextInput value={(newItem[p.id]?.qty) || ''} onChangeText={(t) => setNewItem(prev => ({ ...prev, [p.id]: { designation: prev[p.id]?.designation || '', qty: t } }))} placeholder="0" keyboardType="numeric" className="border-0 px-0 py-0" />
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      const des = (newItem[p.id]?.designation || '').trim();
                      const qtyStr = (newItem[p.id]?.qty || '').trim();
                      const qty = qtyStr === '' ? null : Number(qtyStr);
                      if (!des || !qty || qty <= 0) { Alert.alert('Enter item and qty'); return; }
                      try { await db.addPackageItem({ order_package_id: p.id, designation: des, quantity: qty }); setNewItem(prev => ({ ...prev, [p.id]: { designation: '', qty: '' } })); await load(); } catch (e) { console.error('Add item error:', e); Alert.alert('Error', 'Failed to add item'); }
                    }}
                    className={`px-3 py-2 rounded ${allowOriginalEdits ? 'bg-green-600' : 'bg-gray-300'}`}
                    disabled={!allowOriginalEdits}
                  >
                    <Text className="text-white font-medium">Add Item</Text>
                  </TouchableOpacity>
                </View>
                <OrderPackingItems orderPackageId={p.id} />
              </View>

              {/* Securing section: admin edits ORIGINAL fields inline (manual save) */}
              <View className="mt-3">
                <OrderSecuringSection orderPackageId={p.id} editTarget="original" editable={allowOriginalEdits} autoSave={false} />
              </View>

              {/* Materials (Accessories) for this box */}
              <View className="mt-3">
                <AccessoriesSection orderPackageId={p.id} />
              </View>

              {/* Gas packing (conditional) */}
              {(() => {
                const draft = infoDrafts[p.id];
                const packTypeId = draft?.packing_type_id || (null as any);
                const hasGas = packTypeId ? !!packTypeHasGas[packTypeId] : false;
                return hasGas ? (
                  <View className="mt-3">
                    <GasPackingSection orderPackageId={p.id} />
                  </View>
                ) : null;
              })()}

              {/* Vacuum packing (conditional) */}
              {(() => {
                // find original packing type id for this package
                const originalInfoId = (p as any).original_pkg_info;
                const draft = infoDrafts[p.id];
                const packTypeId = draft?.packing_type_id || (null as any);
                const hasVac = packTypeId ? !!packTypeHasVacuum[packTypeId] : false;
                return hasVac ? (
                  <View className="mt-3">
                    <VacuumPackingSection orderPackageId={p.id} />
                  </View>
                ) : null;
              })()}
              </View>
            )
          ))}
        </View>
      </ScrollView>

      {/* Delete Package Modal */}
      <DeletePackageModal
        visible={deleteModal.visible}
        packageId={deleteModal.packageId}
        packageNumber={deleteModal.packageNumber}
        onClose={() => setDeleteModal({ visible: false, packageId: '', packageNumber: null })}
        onDeleted={async () => { await load(); }}
      />

      {/* Add Box Modal */}
      {showAddBox && (
        <PackageForm
          orderId={orderId as string}
          nextPackageNumber={(packages || []).length ? Math.max(...packages.map(p => p.package_number || 0)) + 1 : 1}
          onCancel={() => setShowAddBox(false)}
          onCreated={async () => { setShowAddBox(false); await load(); }}
        />
      )}

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

      {/* Reset packer data confirmation modal */}
      <ConfirmModal
        visible={resetConfirmOpen}
        title="Reset All Packer Data"
        description="This will remove all data entered by packers including: materials added, tasks started, final values for package items and info, and securing templates. This action cannot be undone. Are you sure?"
        confirmText="Reset All Data"
        cancelText="Cancel"
        variant="danger"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={handleResetPackerData}
      />
    </SafeAreaView>
  );
}
