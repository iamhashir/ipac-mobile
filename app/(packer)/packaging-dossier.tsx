import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../utils/AuthContext';
import { db } from '../../utils/api/supabase';
import { ArrowLeft } from 'lucide-react-native';
import { NavigationButtons } from '../../components/NavigationButtons';
import { usePackerSession } from '../../utils/PackerSessionContext';

interface Order {
  id: string;
  order_name: string;
  client_name: string;
}

interface OrderPackage {
  id: string;
  order_id: string;
  package_number: number;
  description: string | null;
  status: 'design' | 'approved' | 'in_production' | 'packed' | 'delivered';
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

export default function PackagingDossier() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { loading: sessionLoading, canAccessPackaging, canAccessAttendance, session } = usePackerSession();
  const orderId = (params.orderId as string) || session?.order_id || '';
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAfternoon, setIsAfternoon] = useState(false);

  // Packaging data
  const [orderPackages, setOrderPackages] = useState<OrderPackage[]>([]);
  const [pkgInfoMap, setPkgInfoMap] = useState<Record<string, PackageInfo>>({});
  const [materialNames, setMaterialNames] = useState<Record<string, string>>({});
  const [packingTypeNames, setPackingTypeNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'list' | string>('list'); // 'list' or package id

  // Guard: require attendance to be completed before accessing packaging
  useEffect(() => {
    if (!sessionLoading) {
      if (!canAccessAttendance()) {
        Alert.alert('Access Denied', 'Please complete team selection first.', [
          { text: 'Go to Dashboard', onPress: () => router.replace('/(packer)/dashboard') }
        ]);
        return;
      }
      if (!canAccessPackaging()) {
        Alert.alert('Access Denied', 'Please complete attendance before accessing packaging.', [
          { text: 'Go to Attendance', onPress: () => router.replace('/(packer)/attendance' + (session?.order_id ? `?orderId=${session.order_id}` : '')) }
        ]);
        return;
      }
    }
  }, [sessionLoading, canAccessPackaging, canAccessAttendance, session?.order_id]);

  useEffect(() => {
    loadData();
    checkTime();
  }, [orderId]);

  const loadData = async () => {
    try {
      if (!orderId) return;
      // Load order details
      const { data: orderData, error: orderError } = await db.getOrderById(orderId);
      if (orderError) {
        console.error('Error loading order:', orderError);
        Alert.alert('Error', 'Failed to load order details');
        return;
      }
      setOrder(orderData);

      // Load order packages
      const { data: pkgs, error: pkgsError } = await db.getOrderPackages(orderId);
      if (pkgsError) {
        console.error('Error loading order packages:', pkgsError);
        Alert.alert('Error', 'Failed to load packages for this order');
        return;
      }
      const sorted = (pkgs || []).sort((a, b) => (a.package_number || 0) - (b.package_number || 0));
      setOrderPackages(sorted as OrderPackage[]);

      // Gather package_info IDs
      const infoIds = Array.from(new Set(sorted.flatMap(p => [p.original_pkg_info, p.final_pkg_info]).filter(Boolean))) as string[];
      if (infoIds.length > 0) {
        const { data: infos, error: infosError } = await db.getPackageInfosByIds(infoIds);
        if (infosError) {
          console.error('Error loading package_info:', infosError);
        } else if (infos) {
          const infoMap: Record<string, PackageInfo> = {};
          (infos as PackageInfo[]).forEach(i => { infoMap[i.id] = i; });
          setPkgInfoMap(infoMap);

          // Gather related material and packing type IDs
          const materialIds = Array.from(new Set((infos as PackageInfo[]).map(i => i.box_type_id).filter(Boolean))) as string[];
          const packingIds = Array.from(new Set((infos as PackageInfo[]).map(i => i.packing_type_id).filter(Boolean))) as string[];

          if (materialIds.length > 0) {
            const { data: mats } = await db.getMaterialsByIds(materialIds);
            if (mats) {
              const mMap: Record<string, string> = {};
              (mats as any[]).forEach(m => { mMap[m.id] = m.name; });
              setMaterialNames(mMap);
            }
          }
          if (packingIds.length > 0) {
            const { data: types } = await db.getPackingTypesByIds(packingIds);
            if (types) {
              const pMap: Record<string, string> = {};
              (types as any[]).forEach(t => { pMap[t.id] = t.name || t.code; });
              setPackingTypeNames(pMap);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error in loadData:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const checkTime = () => {
    const now = new Date();
    const hour = now.getHours();
    setIsAfternoon(hour >= 12);
  };

  const getCurrentShift = (): 'morning' | 'afternoon' => {
    return isAfternoon ? 'afternoon' : 'morning';
  };

  const handleBack = () => {
    router.back();
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
        Alert.alert('Error', 'Failed to sign out');
      } else {
        router.replace('/auth/login');
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      Alert.alert('Error', 'An unexpected error occurred during sign out');
    }
  };

  const getMaterialName = (id?: string | null) => (id ? (materialNames[id] || '—') : '—');
  const getPackingTypeName = (id?: string | null) => (id ? (packingTypeNames[id] || '—') : '—');
  const yesNo = (v?: boolean | null) => (v ? 'Yes' : v === false ? 'No' : '—');
  const num = (v?: number | null) => (v === 0 || v ? String(v) : '—');

  // Table columns meta for reuse
  const tableHeader = useMemo(() => ([
    { key: 'box', label: 'Box #' },
    { key: 'qty', label: 'Qty' },
    { key: 'name', label: 'Name of Equipment' },
    { key: 'orig_cog', label: 'COG (Orig)' },
    { key: 'orig_qty', label: 'Qty (Orig)' },
    { key: 'orig_box', label: 'Box Type (Orig)' },
    { key: 'orig_pack', label: 'Packing Type (Orig)' },
    { key: 'orig_tare', label: 'Tare (Orig)' },
    { key: 'orig_net', label: 'Net (Orig)' },
    { key: 'orig_gross', label: 'Gross (Orig)' },
    { key: 'fin_cog', label: 'COG (Final)' },
    { key: 'fin_qty', label: 'Qty (Final)' },
    { key: 'fin_box', label: 'Box Type (Final)' },
    { key: 'fin_pack', label: 'Packing Type (Final)' },
    { key: 'fin_tare', label: 'Tare (Final)' },
    { key: 'fin_net', label: 'Net (Final)' },
    { key: 'fin_gross', label: 'Gross (Final)' },
  ]), []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-lg text-gray-600">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-primary-50">
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 bg-primary-500">
        <TouchableOpacity 
          onPress={handleBack}
          className="flex-row items-center"
        >
          <ArrowLeft size={24} color="#fff" />
          <Text className="ml-2 text-white text-base font-semibold">Back</Text>
        </TouchableOpacity>
        
        <Text className="text-white text-xl font-semibold">Packaging Dossier</Text>
        
        <TouchableOpacity 
          onPress={handleSignOut}
          className="bg-primary-600 px-3 py-1 rounded"
        >
          <Text className="text-white text-sm">Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Buttons */}
      <NavigationButtons currentScreen="packaging-dossier" />

      {/* Order/Header Card */}
      {order && (
        <View className="bg-white rounded-lg shadow-sm border border-gray-200 m-4 p-4">
          <View className="flex-row justify-between">
            <Text className="text-gray-800 font-semibold">Project: <Text className="font-bold">{order.order_name}</Text></Text>
            <Text className="text-gray-600">Client: {order.client_name}</Text>
            <Text className="text-gray-600">Shift: {getCurrentShift()}</Text>
          </View>
          <Text className="mt-3 text-gray-600">
            Click on a box tab to view its details. When a box is completed, its tab can turn green.
          </Text>
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mx-4 mb-2">
        <View className="flex-row">
          <TouchableOpacity
            onPress={() => setActiveTab('list')}
            className={`px-4 py-2 mr-2 rounded-t-lg border ${activeTab === 'list' ? 'bg-white border-primary-500' : 'bg-gray-100 border-gray-300'}`}
          >
            <Text className={`${activeTab === 'list' ? 'text-primary-700' : 'text-gray-700'} font-semibold`}>Packing List</Text>
          </TouchableOpacity>
          {orderPackages.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setActiveTab(p.id)}
              className={`px-4 py-2 mr-2 rounded-t-lg border ${activeTab === p.id ? 'bg-white border-primary-500' : 'bg-gray-100 border-gray-300'}`}
            >
              <Text className={`${activeTab === p.id ? 'text-primary-700' : 'text-gray-700'} font-semibold`}>Box #{p.package_number}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Content */}
      {activeTab === 'list' ? (
        <View className="mx-4 mb-4 bg-white rounded-b-lg border border-gray-200">
          <ScrollView horizontal showsHorizontalScrollIndicator className="rounded-b-lg">
            <View>
              {/* Header row */}
              <View className="flex-row bg-primary-50 border-b border-gray-200">
                {tableHeader.map((h) => (
                  <View key={h.key} className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                    <Text className="text-gray-700 font-semibold text-xs">{h.label}</Text>
                  </View>
                ))}
              </View>

              {/* Rows */}
              {orderPackages.map((p, idx) => {
                const orig = p.original_pkg_info ? pkgInfoMap[p.original_pkg_info] : undefined;
                const fin = p.final_pkg_info ? pkgInfoMap[p.final_pkg_info] : undefined;
                return (
                  <View key={p.id} className={`flex-row ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                    {/* Box # */}
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{p.package_number ?? '—'}</Text>
                    </View>
                    {/* Qty */}
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{p.quantity ?? '—'}</Text>
                    </View>
                    {/* Name */}
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 240 }}>
                      <Text className="text-gray-800">{p.description || '—'}</Text>
                    </View>

                    {/* Original info */}
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{yesNo(orig?.center_of_gravity)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{num(orig?.quantity)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 180 }}>
                      <Text className="text-gray-800">{getMaterialName(orig?.box_type_id)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 180 }}>
                      <Text className="text-gray-800">{getPackingTypeName(orig?.packing_type_id)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{num(orig?.tare)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{num(orig?.net_weight)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{num(orig?.gross_weight)}</Text>
                    </View>

                    {/* Final info */}
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{yesNo(fin?.center_of_gravity)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{num(fin?.quantity)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 180 }}>
                      <Text className="text-gray-800">{getMaterialName(fin?.box_type_id)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 180 }}>
                      <Text className="text-gray-800">{getPackingTypeName(fin?.packing_type_id)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{num(fin?.tare)}</Text>
                    </View>
                    <View className="px-3 py-2 border-r border-gray-200" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{num(fin?.net_weight)}</Text>
                    </View>
                    <View className="px-3 py-2" style={{ minWidth: 140 }}>
                      <Text className="text-gray-800">{num(fin?.gross_weight)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : (
        // Package details tab content
        (() => {
          const pkg = orderPackages.find(p => p.id === activeTab);
          const orig = pkg?.original_pkg_info ? pkgInfoMap[pkg.original_pkg_info] : undefined;
          const fin = pkg?.final_pkg_info ? pkgInfoMap[pkg.final_pkg_info] : undefined;
          return (
            <ScrollView className="flex-1 mx-4 mb-4">
              <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-lg font-semibold text-gray-800">Box #{pkg?.package_number}</Text>
                <Text className="text-gray-600 mt-1">Status: {pkg?.status}</Text>
                <Text className="text-gray-600 mt-1">Quantity: {pkg?.quantity ?? '—'}</Text>
                <Text className="text-gray-700 mt-3">{pkg?.description || 'No description'}</Text>
              </View>

              <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-base font-semibold text-gray-800 mb-2">Original Spec</Text>
                <View className="flex-row flex-wrap">
                  <Spec label="Center of Gravity" value={yesNo(orig?.center_of_gravity)} />
                  <Spec label="Qty" value={num(orig?.quantity)} />
                  <Spec label="Box Type" value={getMaterialName(orig?.box_type_id)} />
                  <Spec label="Packing Type" value={getPackingTypeName(orig?.packing_type_id)} />
                  <Spec label="Tare" value={num(orig?.tare)} />
                  <Spec label="Net Weight" value={num(orig?.net_weight)} />
                  <Spec label="Gross Weight" value={num(orig?.gross_weight)} />
                </View>
              </View>

              <View className="bg-white rounded-lg border border-gray-200 p-4">
                <Text className="text-base font-semibold text-gray-800 mb-2">Final Spec</Text>
                <View className="flex-row flex-wrap">
                  <Spec label="Center of Gravity" value={yesNo(fin?.center_of_gravity)} />
                  <Spec label="Qty" value={num(fin?.quantity)} />
                  <Spec label="Box Type" value={getMaterialName(fin?.box_type_id)} />
                  <Spec label="Packing Type" value={getPackingTypeName(fin?.packing_type_id)} />
                  <Spec label="Tare" value={num(fin?.tare)} />
                  <Spec label="Net Weight" value={num(fin?.net_weight)} />
                  <Spec label="Gross Weight" value={num(fin?.gross_weight)} />
                </View>
              </View>
            </ScrollView>
          );
        })()
      )}
    </SafeAreaView>
  );
}

// Small helper for spec display
const Spec = ({ label, value }: { label: string; value: string; }) => (
  <View className="w-1/2 md:w-1/3 p-2">
    <Text className="text-gray-500 text-xs">{label}</Text>
    <Text className="text-gray-800 font-medium">{value}</Text>
  </View>
);

