import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, Alert, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { usePackerSession } from '../../utils/PackerSessionContext';
import { db } from '../../utils/api/supabase';
import { ArrowLeft } from 'lucide-react-native';
import { NavigationButtons } from '../../components/NavigationButtons';
import TabLayout, { TabDefinition } from '../../components/packing/TabLayout';
import PackingListTable, { PackingRow } from '../../components/packing/PackingListTable';
import BoxDetailsTab from '../../components/packing/BoxDetailsTab';
import OrderTasksManagement from '../../components/packing/order_tasks_management';
import OrderSecuringSection from '../../components/packing/OrderSecuringSection';
import VacuumPackingSection from '../../components/packing/VacuumPackingSection';
import AccessoriesSection from '../../components/packing/AccessoriesSection';
import CollapsibleCard from '../../components/packing/common/CollapsibleCard';

interface Order {
  id: string;
  order_name: string;
  client_name: string;
}

interface OrderPackage {
  id: string;
  order_id: string;
  package_number: number | null;
  description: string | null;
  status: string;
  quantity: number | null;
  boxes_completed: number | null;
  original_pkg_info: string | null;
  final_pkg_info: string | null;
}

interface PackageInfo {
  id: string;
  center_of_gravity: boolean | null;
  quantity: number | null;
  box_type_id: string | null;
  packing_type_id: string | null;
  tare: number | null;
  net_weight: number | null;
  gross_weight: number | null;
}

export default function PackingReportPage() {
  const { signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { loading: sessionLoading, canAccessPackaging, canAccessAttendance, session } = usePackerSession();
  const orderId = (params.orderId as string) || session?.order_id || '';
  
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: number }>({});
  const screenHeight = Dimensions.get('window').height;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>('list');

  const [orderPackages, setOrderPackages] = useState<OrderPackage[]>([]);
  const [pkgInfoMap, setPkgInfoMap] = useState<Record<string, PackageInfo>>({});
  const [materials, setMaterials] = useState<Record<string, string>>({});
  const [packingTypes, setPackingTypes] = useState<Record<string, string>>({});
  const [equipmentMap, setEquipmentMap] = useState<Record<string, string>>({}); // order_package_id -> aggregated names

  // Check permissions only once when session loading is complete
  useEffect(() => {
    if (!sessionLoading) {
      // Only check permissions if we have a valid orderId (either from params or session)
      if (orderId) {
        if (!canAccessAttendance()) {
          Alert.alert('Access Denied', 'Please complete team selection first.', [
            { text: 'Go to Dashboard', onPress: () => router.replace('/(packer)/dashboard') }
          ]);
          return;
        }
        if (!canAccessPackaging()) {
          Alert.alert('Access Denied', 'Please complete attendance before accessing packing.', [
            { text: 'Go to Attendance', onPress: () => router.replace('/(packer)/attendance' + (session?.order_id ? `?orderId=${session.order_id}` : '')) }
          ]);
          return;
        }
      }
    }
  }, [sessionLoading, orderId]); // Simplified dependencies to prevent infinite loops

  // Load data only when orderId changes and we're not in the middle of loading
  useEffect(() => {
    if (orderId && !sessionLoading) {
      loadData();
    }
  }, [orderId, sessionLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!orderId) {
        console.warn('No orderId provided to loadData');
        return;
      }
      
      console.log('Loading order data for orderId:', orderId);
      const { data: orderData, error: orderErr } = await db.getOrderById(orderId);
      if (orderErr) {
        console.error('Error loading order:', orderErr);
        Alert.alert('Error', 'Failed to load order');
        return;
      }
      setOrder(orderData);

      console.log('Loading order packages...');
      const { data: pkgs, error: pkgsErr } = await db.getOrderPackages(orderId);
      if (pkgsErr) {
        console.error('Error loading order packages:', pkgsErr);
        Alert.alert('Error', 'Failed to load order packages');
        return;
      }
      const sorted = (pkgs || []).sort((a, b) => (a.package_number || 0) - (b.package_number || 0));
      setOrderPackages(sorted);

      // Ensure securing rows exist for FINAL for all packages (packers edit final)
      for (const p of sorted) {
        try { await db.ensureFinalSecuringForPackage(p.id); } catch (_) {}
      }

      // Load original and final package_info rows
      const finalInfoIds = Array.from(new Set(sorted.map(p => p.final_pkg_info).filter(Boolean))) as string[];
      const originalInfoIds = Array.from(new Set(sorted.map(p => p.original_pkg_info).filter(Boolean))) as string[];
      const infoIds = Array.from(new Set([...(finalInfoIds || []), ...(originalInfoIds || [])]));
      if (infoIds.length > 0) {
        const { data: infos } = await db.getPackageInfosByIds(infoIds);
        const map: Record<string, PackageInfo> = {};
        (infos || []).forEach((i: any) => { map[i.id] = i; });
        setPkgInfoMap(map);

        const materialIds = Array.from(new Set((infos || []).map((i: any) => i.box_type_id).filter(Boolean)));
        const packingIds = Array.from(new Set((infos || []).map((i: any) => i.packing_type_id).filter(Boolean)));
        if (materialIds.length) {
          const { data: mats } = await db.getMaterialsByIds(materialIds);
          const m: Record<string, string> = {};
          (mats || []).forEach((mt: any) => { m[mt.id] = mt.name; });
          setMaterials(m);
        }
        if (packingIds.length) {
          const { data: types } = await db.getPackingTypesByIds(packingIds);
          const pMap: Record<string, string> = {};
          const vMap: Record<string, boolean> = {};
          (types || []).forEach((t: any) => { pMap[t.id] = t.code; vMap[t.id] = !!t.includes_vacuum_protection; });
          setPackingTypes(pMap);
          setPackTypeHasVacuum(vMap);
        }
      }

      // Load package_items and aggregate names
      const opIds = sorted.map(p => p.id);
      if (opIds.length) {
        const { data: items } = await db.getPackageItemsByOrderPackageIds(opIds);
        const em: Record<string, string> = {};
        (items || []).forEach((it: any) => {
          const key = it.order_package_id;
          const label = it.designation || '';
          if (!em[key]) em[key] = label;
          else if (label) em[key] = `${em[key]}, ${label}`;
        });
        setEquipmentMap(em);
      }

    } catch (e) {
      console.error('Packing Report load error', e);
      Alert.alert('Error', 'Unexpected error while loading packing report');
    } finally {
      // Always set loading to false, regardless of success or failure
      console.log('loadData completed, setting loading to false');
      setLoading(false);
    }
  };

  const [packTypeHasVacuum, setPackTypeHasVacuum] = useState<Record<string, boolean>>({});

  const rows: PackingRow[] = useMemo(() => {
    return orderPackages.map(p => {
      const info = p.final_pkg_info ? pkgInfoMap[p.final_pkg_info] : undefined;
      return {
        id: p.id,
        packageNumber: p.package_number ?? null,
        orderQuantity: p.quantity ?? null,
        equipmentName: equipmentMap[p.id] || '—',
        centerOfGravity: info?.center_of_gravity ?? null,
        boxQuantity: info?.quantity ?? null,
        boxTypeName: info?.box_type_id ? (materials[info.box_type_id] || '—') : '—',
        packingTypeName: info?.packing_type_id ? (packingTypes[info.packing_type_id] || '—') : '—',
        tare: info?.tare ?? null,
        netWeight: info?.net_weight ?? null,
        grossWeight: info?.gross_weight ?? null,
      };
    });
  }, [orderPackages, pkgInfoMap, equipmentMap, materials, packingTypes]);

  const tabs: TabDefinition[] = useMemo(() => {
    const listTab: TabDefinition = {
      key: 'list',
      title: 'Packing List',
      content: (
        <PackingListTable
          rows={rows}
          onRowPress={(id) => setActiveKey(id)}
        />
      ),
    };

    const boxTabs: TabDefinition[] = orderPackages.map((p) => {
      const original = p.original_pkg_info ? pkgInfoMap[p.original_pkg_info] : undefined;
      const final = p.final_pkg_info ? pkgInfoMap[p.final_pkg_info] : undefined;

      const infoOriginal = {
        quantity: original?.quantity ?? null,
        sei: original?.packing_type_id ? (packingTypes[original.packing_type_id] || '—') : '—',
        boxType: original?.box_type_id ? (materials[original.box_type_id] || '—') : '—',
        tare: original?.tare ?? null,
        netWeight: original?.net_weight ?? null,
        grossWeight: original?.gross_weight ?? null,
        centerOfGravity: original?.center_of_gravity ?? null,
      };
      const infoFinal = {
        quantity: final?.quantity ?? null,
        sei: final?.packing_type_id ? (packingTypes[final.packing_type_id] || '—') : '—',
        boxType: final?.box_type_id ? (materials[final?.box_type_id] || '—') : '—',
        tare: final?.tare ?? null,
        netWeight: final?.net_weight ?? null,
        grossWeight: final?.gross_weight ?? null,
        centerOfGravity: final?.center_of_gravity ?? null,
      };

      const internalDimsOriginal = original ? {
        length: original.internal_length ?? null,
        width: original.internal_width ?? null,
        height: original.internal_height ?? null,
      } : null;
      const internalDimsFinal = final ? {
        length: final.internal_length ?? null,
        width: final.internal_width ?? null,
        height: final.internal_height ?? null,
      } : null;
      const externalDimsOriginal = original ? {
        length: original.external_length ?? null,
        width: original.external_width ?? null,
        height: original.external_height ?? null,
      } : null;
      const externalDimsFinal = final ? {
        length: final.external_length ?? null,
        width: final.external_width ?? null,
        height: final.external_height ?? null,
      } : null;

      return {
        key: p.id,
        title: `Box #${p.package_number ?? ''}`,
        content: (
          <View>
            <BoxDetailsTab 
              orderPackageId={p.id}
              packageNumber={p.package_number ?? null} 
              description={p.description}
              info={{ original: infoOriginal, final: infoFinal }}
              dimensions={{
                internal: { original: internalDimsOriginal, final: internalDimsFinal },
                external: { original: externalDimsOriginal, final: externalDimsFinal },
              }}
              originalPkgInfoId={p.original_pkg_info}
              finalPkgInfoId={p.final_pkg_info}
              originalBoxTypeId={original?.box_type_id || null}
              finalBoxTypeId={final?.box_type_id || null}
              originalPackingTypeId={original?.packing_type_id || null}
              finalPackingTypeId={final?.packing_type_id || null}
            />

            {/* Per-package Task Management (collapsible, white background, rounded, separated by main blue bg) */}
            <View 
              className="mx-4 mt-4 mb-4"
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                sectionRefs.current['items'] = y;
              }}
            >
              <CollapsibleCard
                title="Task Management"
                containerClassName="bg-white border-gray-500"
                headerClassName=""
                contentClassName=""
                defaultOpen={true}
              >
                <OrderTasksManagement
                  orderId={orderId}
                  orderPackages={[{ id: p.id, package_number: p.package_number }]}
                />
              </CollapsibleCard>
            </View>

            {/* Securing section */}
            <View
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                sectionRefs.current['securing'] = y;
              }}
            >
              <OrderSecuringSection orderPackageId={p.id} editTarget="final" editable={true} autoSave={false} />
            </View>

            {/* Vacuum packing (Final packing type) */}
            {(() => {
              const finalId = (pkgInfoMap[p.final_pkg_info || ''] as any)?.packing_type_id || null;
              const originalId = (pkgInfoMap[p.original_pkg_info || ''] as any)?.packing_type_id || null;
              const hasVac = (finalId && packTypeHasVacuum[finalId]) || (originalId && packTypeHasVacuum[originalId]);
              return hasVac ? (
                <View>
                  <VacuumPackingSection orderPackageId={p.id} />
                </View>
              ) : null;
            })()}

            {/* Accessories section */}
            <View
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                sectionRefs.current['accessories'] = y;
              }}
            >
              <AccessoriesSection orderPackageId={p.id} />
            </View>
          </View>
        ),
      } as TabDefinition;
    });

    return [listTab, ...boxTabs];
  }, [rows, orderPackages, orderId, pkgInfoMap, materials, packingTypes]);

  const handleBack = () => router.back();
  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) Alert.alert('Error', 'Failed to sign out');
    else router.replace('/auth/login');
  };

  // Show loading screen for session loading or data loading
  if (sessionLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-lg text-gray-600">
            {sessionLoading ? 'Checking session...' : 'Loading packing data...'}
          </Text>
          {orderId && (
            <Text className="text-sm text-gray-500 mt-2">Order ID: {orderId}</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Early return if no orderId is available
  if (!orderId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-lg text-red-600">No order ID provided</Text>
          <TouchableOpacity 
            onPress={() => router.replace('/(packer)/dashboard')} 
            className="mt-4 bg-primary-500 px-4 py-2 rounded"
          >
            <Text className="text-white">Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-primary-50">
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center p-4 bg-primary-500">
          <TouchableOpacity onPress={handleBack} className="flex-row items-center">
            <ArrowLeft size={24} color="#fff" />
            <Text className="ml-2 text-white text-base font-semibold">Back</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-semibold">Packing List</Text>
          <TouchableOpacity onPress={handleSignOut} className="bg-primary-600 px-3 py-1 rounded">
            <Text className="text-white text-sm">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Nav buttons */}
        <NavigationButtons currentScreen="packing-report" />

        {/* Order summary */}
        {order && (
          <View className="bg-white rounded-lg border border-gray-200 m-4 p-4">
            <View className="flex-row justify-between">
              <Text className="text-gray-800 font-semibold">Project: <Text className="font-bold">{order.order_name}</Text></Text>
              <Text className="text-gray-600">Client: {order.client_name}</Text>
            </View>
            <Text className="mt-3 text-gray-600">Click a row or tab to view specific box details.</Text>
          </View>
        )}

        {/* Tabs */}
        <View
          onLayout={(event) => {
            const { y } = event.nativeEvent.layout;
            sectionRefs.current['info'] = y;
          }}
        >
          <TabLayout tabs={tabs} activeKey={activeKey} onChange={setActiveKey} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

