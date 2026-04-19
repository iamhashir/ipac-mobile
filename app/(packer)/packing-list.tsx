import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../utils/AuthContext";
import { usePackerSession } from "../../utils/PackerSessionContext";
import { useTextSize } from "../../utils/TextSizeContext";
import { db, supabase } from "../../utils/api/supabase";
import { ArrowLeft, Plus } from "lucide-react-native";
import { NavigationButtons } from "../../components/NavigationButtons";
import TabLayout, {
  TabDefinition,
} from "../../components/packer/packing-list/shared/navigation/TabLayout";
import PackingListTable, {
  PackingRow,
} from "../../components/packer/packing-list/section_00_overview/PackingListTable";
import BoxDetailsTab from "../../components/packer/packing-list/section_01_packing_info/BoxDetailsTab";
import AddPackageTab from "../../components/packer/packing-list/AddPackageTab";
import OrderTasksManagement from "../../components/packer/packing-list/section_04_tasks/OrderTasksManagement";
import ManufacturingSection from "../../components/packer/packing-list/section_05_manufacturing/ManufacturingSection";
import VacuumPackingSection from "../../components/packer/packing-list/section_08_vacuum/VacuumPackingSection";
import GasPackingSection from "../../components/packer/packing-list/section_07_gas/GasPackingSection";
import AccessoriesSection from "../../components/packer/packing-list/section_09_accessories/AccessoriesSection";
import SecuringSection from "../../components/packer/packing-list/section_06_securing/SecuringSection";
import CoverSection from "../../components/packer/packing-list/section_10_cover/CoverSection";
import CommentsSection from "../../components/packer/packing-list/section_03_comments/CommentsSection";
import CollapsibleCard from "../../components/packer/packing-list/common/CollapsibleCard";
import { PackageInfoChangeEvent } from "../../components/packer/packing-list/section_01_packing_info/types";

interface Order {
  id: string;
  order_name: string;
  client_name: string;
  client_id?: string | null;
  client?: { portal_settings_id?: string | null } | null;
  production_status?: string;
  project_type?: 'standard' | 'maintenance' | 'survey' | null;
}

interface OrderPackage {
  id: string;
  order_id: string;
  package_number: number | null;
  reference: string | null;
  description: string | null;
  status: string;
  quantity: number | null;
  boxes_completed: number | null;
  original_pkg_info: string | null;
  final_pkg_info: string | null;
}

interface OrderPackageOverview {
  id: string;
  order_id: string;
  pkg_number: number | null;
  status: string;
  quantity: number | null;
  quantity_packed: number | null;
  description: string | null;
}

interface OrderPackageInstance {
  id: string;
  order_pkg_overview_id: string;
  order_package_id: string;
  instance_number: number | null;
  status: string;
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
  internal_length: number | null;
  internal_width: number | null;
  internal_height: number | null;
  external_length: number | null;
  external_width: number | null;
  external_height: number | null;
  sei_category?: number | null;
  sei_protection?: number | null;
}

const createEmptyPackageInfo = (id: string): PackageInfo => ({
  id,
  center_of_gravity: null,
  quantity: null,
  box_type_id: null,
  packing_type_id: null,
  tare: null,
  net_weight: null,
  gross_weight: null,
  internal_length: null,
  internal_width: null,
  internal_height: null,
  external_length: null,
  external_width: null,
  external_height: null,
  sei_category: null,
  sei_protection: null,
});

export default function PackingListPage() {
  const { signOut, profile } = useAuth() as any;
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    loading: sessionLoading,
    canAccessPackaging,
    canAccessAttendance,
    session,
  } = usePackerSession();
  const { size } = useTextSize();
  const orderId = (params.orderId as string) || session?.order_id || "";

  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: number }>({});
  const screenHeight = Dimensions.get("window").height;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>("list");
  const [previousKey, setPreviousKey] = useState<string>("list");
  const [checkingToolbox, setCheckingToolbox] = useState(true);

  // Reload data when switching back to the packing list tab from a box tab
  const handleTabChange = (newKey: string) => {
    // If switching to 'list' from a box tab, reload data to get latest changes
    if (newKey === "list" && previousKey !== "list") {
      loadData();
    }
    setPreviousKey(activeKey);
    setActiveKey(newKey);
  };

  const [orderPackages, setOrderPackages] = useState<OrderPackage[]>([]);
  const [orderPackageOverviews, setOrderPackageOverviews] = useState<OrderPackageOverview[]>([]);
  const [overviewInstancesMap, setOverviewInstancesMap] = useState<Record<string, OrderPackageInstance[]>>({});
  const [selectedInstanceByOverview, setSelectedInstanceByOverview] = useState<Record<string, string>>({});
  const [pkgInfoMap, setPkgInfoMap] = useState<Record<string, PackageInfo>>({});
  const [boxTypes, setBoxTypes] = useState<Record<string, string>>({});
  const [packingTypes, setPackingTypes] = useState<Record<string, string>>({});
  const [equipmentMap, setEquipmentMap] = useState<Record<string, string>>({}); // order_package_id -> aggregated names
  const [boxStartedMap, setBoxStartedMap] = useState<Record<string, boolean>>(
    {}
  ); // order_package_id -> has started tasks

  // Check toolbox briefing requirement on page load and periodically
  useEffect(() => {
    if (!sessionLoading && orderId && profile?.id) {
      const checkToolboxRequirement = async () => {
        try {
          const { data: needsBriefing } = await db.needsToolboxBriefing(orderId, profile.id);
          
          if (needsBriefing) {
            Alert.alert(
              "Attendance Required",
              "Please mark your attendance and confirm the toolbox briefing before accessing the packing list.",
              [
                {
                  text: "Go to Attendance",
                  onPress: () => router.replace(`/(packer)/attendance?orderId=${orderId}`),
                },
              ],
              { cancelable: false }
            );
          } else {
            setCheckingToolbox(false);
          }
        } catch (error) {
          console.error('Error checking toolbox briefing:', error);
          setCheckingToolbox(false);
        }
      };

      checkToolboxRequirement();
      
      // Check every 2 minutes in case shift changes while they're working
      const interval = setInterval(checkToolboxRequirement, 120000);
      return () => clearInterval(interval);
    }
  }, [sessionLoading, orderId, profile?.id]);

  // Check permissions only once when session loading is complete
  useEffect(() => {
    if (!sessionLoading) {
      // Only check permissions if we have a valid orderId (either from params or session)
      if (orderId) {
        if (!canAccessAttendance()) {
          Alert.alert(
            "Access Denied",
            "Please complete team selection first.",
            [
              {
                text: "Go to Dashboard",
                onPress: () => router.replace("/(packer)/dashboard" as any),
              },
            ]
          );
          return;
        }
        if (!canAccessPackaging()) {
          Alert.alert(
            "Access Denied",
            "Please complete attendance before accessing packing.",
            [
              {
                text: "Go to Attendance",
                onPress: () =>
                  router.replace(
                    (
                      "/(packer)/attendance" +
                      (session?.order_id ? `?orderId=${session.order_id}` : "")
                    ) as any
                  ),
              },
            ]
          );
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

  // Modify loadData to accept an optional parameter for the initial loading spinner
  const loadData = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      if (!orderId) {
        console.warn("No orderId provided to loadData");
        return;
      }

      console.log("Loading order data for orderId:", orderId);
      const { data: orderData, error: orderErr } = await db.getOrderById(
        orderId
      );
      if (orderErr) {
        console.error("Error loading order:", orderErr);
        Alert.alert("Error", "Failed to load order");
        return;
      }
      setOrder(orderData);

      console.log("Loading order packages...");
      const { data: pkgs, error: pkgsErr } = await db.getOrderPackages(orderId);
      if (pkgsErr) {
        console.error("Error loading order packages:", pkgsErr);
        Alert.alert("Error", "Failed to load order packages");
        return;
      }
      const sorted = (pkgs || []).sort(
        (a, b) => (a.package_number || 0) - (b.package_number || 0)
      );
      setOrderPackages(sorted);

      // Load overview/instance model (new pipeline). If missing, UI falls back to legacy package tabs.
      try {
        const { data: overviewsRaw, error: overviewsErr } = await supabase
          .from('order_pkg_overview')
          .select('id, order_id, pkg_number, status, quantity, quantity_packed, description')
          .eq('order_id', orderId)
          .order('pkg_number', { ascending: true });

        if (overviewsErr) {
          console.warn('Error loading order_pkg_overview:', overviewsErr);
          setOrderPackageOverviews([]);
          setOverviewInstancesMap({});
          setSelectedInstanceByOverview({});
        } else {
          const overviews = (overviewsRaw || []) as OrderPackageOverview[];
          setOrderPackageOverviews(overviews);

          const overviewIds = overviews.map((overview) => overview.id).filter(Boolean);
          if (overviewIds.length > 0) {
            const { data: instancesRaw, error: instancesErr } = await supabase
              .from('order_pkg_instance')
              .select('id, order_pkg_overview_id, order_package_id, instance_number, status')
              .in('order_pkg_overview_id', overviewIds)
              .order('instance_number', { ascending: true });

            if (instancesErr) {
              console.warn('Error loading order_pkg_instance:', instancesErr);
              setOverviewInstancesMap({});
              setSelectedInstanceByOverview({});
            } else {
              const groupedInstances: Record<string, OrderPackageInstance[]> = {};
              (instancesRaw || []).forEach((instance: any) => {
                const overviewId = String(instance.order_pkg_overview_id || '');
                if (!overviewId) return;
                if (!groupedInstances[overviewId]) groupedInstances[overviewId] = [];
                groupedInstances[overviewId].push(instance as OrderPackageInstance);
              });

              setOverviewInstancesMap(groupedInstances);
              setSelectedInstanceByOverview((prev) => {
                const next: Record<string, string> = {};
                overviews.forEach((overview) => {
                  const instances = groupedInstances[overview.id] || [];
                  if (!instances.length) return;

                  const previousSelection = prev[overview.id];
                  const hasPreviousSelection = !!previousSelection && instances.some((inst) => inst.id === previousSelection);
                  next[overview.id] = hasPreviousSelection ? previousSelection : instances[0].id;
                });
                return next;
              });
            }
          } else {
            setOverviewInstancesMap({});
            setSelectedInstanceByOverview({});
          }
        }
      } catch (overviewLoadError) {
        console.warn('Unexpected overview/instance load error:', overviewLoadError);
        setOrderPackageOverviews([]);
        setOverviewInstancesMap({});
        setSelectedInstanceByOverview({});
      }

      // Ensure securing rows exist for FINAL for all packages (packers edit final)
      for (const p of sorted) {
        try {
          await db.ensureFinalSecuringForPackage(p.id);
        } catch (_) {}
      }

      // Load original and final package_info rows
      const finalInfoIds = Array.from(
        new Set(sorted.map((p) => p.final_pkg_info).filter(Boolean))
      ) as string[];
      const originalInfoIds = Array.from(
        new Set(sorted.map((p) => p.original_pkg_info).filter(Boolean))
      ) as string[];
      const infoIds = Array.from(
        new Set([...(finalInfoIds || []), ...(originalInfoIds || [])])
      );
      if (infoIds.length > 0) {
        const { data: infos } = await db.getPackageInfosByIds(infoIds);
        const map: Record<string, PackageInfo> = {};
        (infos || []).forEach((i: any) => {
          map[i.id] = i;
        });
        setPkgInfoMap(map);

        const boxTypeIds = Array.from(
          new Set((infos || []).map((i: any) => i.box_type_id).filter(Boolean))
        );
        const packingIds = Array.from(
          new Set(
            (infos || []).map((i: any) => i.packing_type_id).filter(Boolean)
          )
        );
        if (boxTypeIds.length) {
          const { data: boxes } = await db.getBoxTypesByIds(boxTypeIds);
          const m: Record<string, string> = {};
          (boxes || []).forEach((mt: any) => {
            m[mt.id] = mt.name;
          });
          setBoxTypes(m);
        }
        if (packingIds.length) {
          const { data: types } = await db.getPackingTypesByIds(packingIds);
          const pMap: Record<string, string> = {};
          const vMap: Record<string, boolean> = {};
          const gMap: Record<string, boolean> = {};
          (types || []).forEach((t: any) => {
            pMap[t.id] = t.code;
            vMap[t.id] = !!t.includes_vacuum_protection;
            gMap[t.id] = !!t.includes_gas_protection;
          });
          setPackingTypes(pMap);
          setPackTypeHasVacuum(vMap);
          setPackTypeHasGas(gMap);
        }
      }

      // Load package_items and aggregate names
      const opIds = sorted.map((p) => p.id);
      if (opIds.length) {
        // Evaluate if this order is using the new portal flow
        const hasPortal = !!(orderData?.client as any)?.portal_settings_id;
        
        const em: Record<string, string> = {};
        
        if (hasPortal && orderData?.client_id) {
          const { data: maintItems } = await db.getMaintenanceItemsForPackages(opIds, orderData.client_id);
          (maintItems || []).forEach((it: any) => {
            const key = it.order_package_id;
            // Use description, or item_num, or reference as the label
            const label = it.maintenance_items?.description || it.maintenance_items?.item_num || it.maintenance_items?.reference || "";
            if (!em[key]) em[key] = label;
            else if (label) em[key] = `${em[key]}, ${label}`;
          });
        } else {
          const { data: items } = await db.getPackageItemsByOrderPackageIds(opIds);
          (items || []).forEach((it: any) => {
            const key = it.order_package_id;
            const label = it.designation || "";
            if (!em[key]) em[key] = label;
            else if (label) em[key] = `${em[key]}, ${label}`;
          });
        }
        setEquipmentMap(em);

        // Check which boxes have started tasks (any task_packages entries)
        const { supabase } = await import("../../utils/api/supabase");
        const { data: taskPackages } = await supabase
          .from("task_packages")
          .select("order_package_id")
          .in("order_package_id", opIds);

        const startedMap: Record<string, boolean> = {};
        (taskPackages || []).forEach((tp: any) => {
          startedMap[tp.order_package_id] = true;
        });
        setBoxStartedMap(startedMap);
      }
    } catch (e) {
      console.error("Packing Report load error", e);
      Alert.alert("Error", "Unexpected error while loading packing report");
    } finally {
      // Always set loading to false, regardless of success or failure
      console.log("loadData completed, setting loading to false");
      if (showLoadingSpinner) setLoading(false);
    }
  };

  const [packTypeHasVacuum, setPackTypeHasVacuum] = useState<
    Record<string, boolean>
  >({});
  const [packTypeHasGas, setPackTypeHasGas] = useState<Record<string, boolean>>(
    {}
  );

  const hydrateBoxType = useCallback(
    async (boxTypeId: string | null) => {
      if (!boxTypeId || boxTypes[boxTypeId]) return;
      const { data } = await db.getBoxTypesByIds([boxTypeId]);
      if (data && data.length) {
        const entry = data[0];
        setBoxTypes((prev) => ({ ...prev, [entry.id]: entry.name }));
      }
    },
    [boxTypes]
  );

  const hydratePackingType = useCallback(
    async (packingTypeId: string | null) => {
      if (!packingTypeId) return;
      const hasCode = !!packingTypes[packingTypeId];
      const hasGasInfo = Object.prototype.hasOwnProperty.call(
        packTypeHasGas,
        packingTypeId
      );
      const hasVacInfo = Object.prototype.hasOwnProperty.call(
        packTypeHasVacuum,
        packingTypeId
      );
      if (hasCode && hasGasInfo && hasVacInfo) return;

      const { data } = await db.getPackingTypesByIds([packingTypeId]);
      if (data && data.length) {
        const entry = data[0];
        setPackingTypes((prev) => ({ ...prev, [entry.id]: entry.code }));
        setPackTypeHasGas((prev) => ({
          ...prev,
          [entry.id]: !!entry.includes_gas_protection,
        }));
        setPackTypeHasVacuum((prev) => ({
          ...prev,
          [entry.id]: !!entry.includes_vacuum_protection,
        }));
      }
    },
    [packTypeHasGas, packTypeHasVacuum, packingTypes]
  );

  const handlePackageInfoChange = useCallback(
    (change: PackageInfoChangeEvent) => {
      if (!change?.infoId) return;
      const updatedFields = (change.fields || {}) as Partial<PackageInfo>;
      setPkgInfoMap((prev) => {
        const base = prev[change.infoId!] || createEmptyPackageInfo(change.infoId!);
        return {
          ...prev,
          [change.infoId!]: { ...base, ...updatedFields },
        };
      });

      if (change.updatedFinalInfoId && change.orderPackageId) {
        setOrderPackages((prev) =>
          prev.map((pkg) =>
            pkg.id === change.orderPackageId && pkg.final_pkg_info !== change.updatedFinalInfoId
              ? { ...pkg, final_pkg_info: change.updatedFinalInfoId ?? null }
              : pkg
          )
        );
      }

      const nextPackingTypeId = updatedFields.packing_type_id;
      if (nextPackingTypeId) {
        void hydratePackingType(nextPackingTypeId);
      }

      const nextBoxTypeId = updatedFields.box_type_id;
      if (nextBoxTypeId) {
        void hydrateBoxType(nextBoxTypeId);
      }
    },
    [hydrateBoxType, hydratePackingType]
  );

  const normalizeReferenceValue = (value: string | null | undefined) => {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : null;
  };

  const handleOrderPackageReferenceChange = useCallback(
    async (orderPackageId: string, nextReference: string | null) => {
      const normalizedReference = normalizeReferenceValue(nextReference);
      let previousReference: string | null = null;

      setOrderPackages((prev) =>
        prev.map((pkg) => {
          if (pkg.id !== orderPackageId) return pkg;
          previousReference = pkg.reference ?? null;
          return { ...pkg, reference: normalizedReference };
        })
      );

      const { error } = await db.updateOrderPackageFields(orderPackageId, {
        reference: normalizedReference,
      });

      if (error) {
        console.error("Error updating package reference:", error);
        Alert.alert("Error", "Failed to save reference");
        setOrderPackages((prev) =>
          prev.map((pkg) =>
            pkg.id === orderPackageId
              ? { ...pkg, reference: previousReference }
              : pkg
          )
        );
      }
    },
    []
  );

  const overviewBoxes = useMemo(() => {
    const packageById = new Map(orderPackages.map((pkg) => [pkg.id, pkg]));

    // Legacy fallback: no overviews yet, render one tab per order_package exactly as before.
    if (!orderPackageOverviews.length) {
      return orderPackages.map((pkg) => {
        const legacyOverviewId = `legacy-overview-${pkg.id}`;
        const legacyInstanceId = `legacy-instance-${pkg.id}`;
        const legacyInstance: OrderPackageInstance = {
          id: legacyInstanceId,
          order_pkg_overview_id: legacyOverviewId,
          order_package_id: pkg.id,
          instance_number: 1,
          status: pkg.status,
        };

        return {
          key: pkg.id,
          overviewId: legacyOverviewId,
          packageNumber: pkg.package_number ?? null,
          quantity: pkg.quantity ?? null,
          quantityPacked: pkg.status === 'packed' ? 1 : 0,
          status: pkg.status,
          description: pkg.description ?? null,
          instances: [legacyInstance],
          selectedInstanceId: legacyInstanceId,
          selectedInstance: legacyInstance,
          orderPackage: pkg,
        };
      });
    }

    return orderPackageOverviews
      .map((overview) => {
        const instances = overviewInstancesMap[overview.id] || [];
        const selectedInstanceIdCandidate = selectedInstanceByOverview[overview.id];
        const selectedInstance =
          instances.find((instance) => instance.id === selectedInstanceIdCandidate) ||
          instances[0] ||
          null;

        const selectedPackage =
          (selectedInstance?.order_package_id
            ? packageById.get(selectedInstance.order_package_id)
            : null) ||
          (instances.length > 0
            ? packageById.get(instances[0].order_package_id)
            : null) ||
          null;

        return {
          key: `overview-${overview.id}`,
          overviewId: overview.id,
          packageNumber: overview.pkg_number ?? selectedPackage?.package_number ?? null,
          quantity: overview.quantity ?? null,
          quantityPacked: overview.quantity_packed ?? null,
          status: overview.status || selectedPackage?.status || 'approved',
          description: overview.description ?? selectedPackage?.description ?? null,
          instances,
          selectedInstanceId: selectedInstance?.id || null,
          selectedInstance,
          orderPackage: selectedPackage,
        };
      })
      .sort((a, b) => (a.packageNumber || 0) - (b.packageNumber || 0));
  }, [
    orderPackages,
    orderPackageOverviews,
    overviewInstancesMap,
    selectedInstanceByOverview,
  ]);

  const rows: PackingRow[] = useMemo(() => {
    return overviewBoxes.map((box) => {
      const p = box.orderPackage;

      // Get original and final info
      const originalInfo = p?.original_pkg_info
        ? pkgInfoMap[p.original_pkg_info]
        : undefined;
      const finalInfo = p?.final_pkg_info
        ? pkgInfoMap[p.final_pkg_info]
        : undefined;

      // Helper to get value and track source: use final if exists, otherwise fall back to original
      const getValue = <T,>(
        finalVal: T | null | undefined,
        originalVal: T | null | undefined
      ): { value: T | null; isFinal: boolean } => {
        // If final value exists and is not null/undefined, use it
        if (finalVal !== null && finalVal !== undefined)
          return { value: finalVal, isFinal: true };
        // Otherwise use original value
        return { value: originalVal ?? null, isFinal: false };
      };

      const centerOfGravity = getValue(
        finalInfo?.center_of_gravity,
        originalInfo?.center_of_gravity
      );
      const legacyBoxQuantity = getValue(finalInfo?.quantity, originalInfo?.quantity);
      const overviewQuantityDefined =
        box.quantity !== null && box.quantity !== undefined && Number.isFinite(Number(box.quantity));
      const overviewQuantity = overviewQuantityDefined ? Number(box.quantity) : null;
      const boxQuantity = {
        value: overviewQuantityDefined ? overviewQuantity : legacyBoxQuantity.value,
        isFinal: overviewQuantityDefined ? false : legacyBoxQuantity.isFinal,
      };
      const boxTypeId = getValue(
        finalInfo?.box_type_id,
        originalInfo?.box_type_id
      );
      const packingTypeId = getValue(
        finalInfo?.packing_type_id,
        originalInfo?.packing_type_id
      );
      const netWeight = getValue(
        finalInfo?.net_weight,
        originalInfo?.net_weight
      );
      const grossWeight = getValue(
        finalInfo?.gross_weight,
        originalInfo?.gross_weight
      );

      const overviewQtyPacked = Number(box.quantityPacked ?? 0);
      const hasOverviewQuantity =
        box.quantity !== null && box.quantity !== undefined && Number.isFinite(Number(box.quantity));
      const isPackedFromOverview = hasOverviewQuantity
        ? overviewQtyPacked >= Number(box.quantity) && Number(box.quantity) > 0
        : false;

      return {
        id: box.key,
        packageNumber: box.packageNumber ?? null,
        reference: p?.reference ?? null,
        orderQuantity: box.quantity ?? p?.quantity ?? null,
        equipmentName: p?.id ? equipmentMap[p.id] || "—" : "—",
        centerOfGravity: centerOfGravity.value,
        centerOfGravityIsFinal: centerOfGravity.isFinal,
        boxQuantity: boxQuantity.value,
        boxQuantityIsFinal: boxQuantity.isFinal,
        boxTypeName: boxTypeId.value ? boxTypes[boxTypeId.value] || "—" : "—",
        boxTypeIsFinal: boxTypeId.isFinal,
        packingTypeName: packingTypeId.value
          ? packingTypes[packingTypeId.value] || "—"
          : "—",
        packingTypeIsFinal: packingTypeId.isFinal,
        netWeight: netWeight.value,
        netWeightIsFinal: netWeight.isFinal,
        grossWeight: grossWeight.value,
        grossWeightIsFinal: grossWeight.isFinal,
        isPacked: isPackedFromOverview || p?.status === "packed",
        isStarted: p?.id ? boxStartedMap[p.id] || false : false,
      };
    });
  }, [
    overviewBoxes,
    pkgInfoMap,
    equipmentMap,
    boxTypes,
    packingTypes,
    boxStartedMap,
  ]);

  const tabs: TabDefinition[] = useMemo(() => {
    const isMaintenanceFlow = (order?.project_type || 'standard') !== 'standard';

    const listTab: TabDefinition = {
      key: "list",
      title: isMaintenanceFlow ? "Maintenance List" : "Packing List",
      content: (
        <PackingListTable
          rows={rows}
          onRowPress={(id) => handleTabChange(id)}
        />
      ),
    };

    const boxTabs: TabDefinition[] = overviewBoxes.map((box) => {
      const p = box.orderPackage;
      const packageId = p?.id || null;
      const original = p?.original_pkg_info
        ? pkgInfoMap[p.original_pkg_info]
        : undefined;
      const final = p?.final_pkg_info ? pkgInfoMap[p.final_pkg_info] : undefined;

      const infoOriginal = {
        quantity: original?.quantity ?? null,
        sei: original?.packing_type_id
          ? packingTypes[original.packing_type_id] || "—"
          : "—",
        boxType: original?.box_type_id
          ? boxTypes[original.box_type_id] || "—"
          : "—",
        tare: original?.tare ?? null,
        netWeight: original?.net_weight ?? null,
        grossWeight: original?.gross_weight ?? null,
        centerOfGravity: original?.center_of_gravity ?? null,
      };
      const infoFinal = {
        quantity: final?.quantity ?? null,
        sei: final?.packing_type_id
          ? packingTypes[final.packing_type_id] || "—"
          : "—",
        boxType: final?.box_type_id ? boxTypes[final?.box_type_id] || "—" : "—",
        tare: final?.tare ?? null,
        netWeight: final?.net_weight ?? null,
        grossWeight: final?.gross_weight ?? null,
        centerOfGravity: final?.center_of_gravity ?? null,
      };

      const internalDimsOriginal = original
        ? {
            length: original.internal_length ?? null,
            width: original.internal_width ?? null,
            height: original.internal_height ?? null,
          }
        : null;
      const internalDimsFinal = final
        ? {
            length: final.internal_length ?? null,
            width: final.internal_width ?? null,
            height: final.internal_height ?? null,
          }
        : null;
      const externalDimsOriginal = original
        ? {
            length: original.external_length ?? null,
            width: original.external_width ?? null,
            height: original.external_height ?? null,
          }
        : null;
      const externalDimsFinal = final
        ? {
            length: final.external_length ?? null,
            width: final.external_width ?? null,
            height: final.external_height ?? null,
          }
        : null;

      const isPackedFromOverview =
        box.quantity !== null && box.quantity !== undefined
          ? Number(box.quantityPacked ?? 0) >= Number(box.quantity) && Number(box.quantity) > 0
          : false;
      const tabIsPacked = isPackedFromOverview || p?.status === 'packed';
      const tabIsStarted = packageId ? boxStartedMap[packageId] || false : false;
      const selectedOperationalInstanceId =
        box.selectedInstanceId && !box.selectedInstanceId.startsWith('legacy-instance-')
          ? box.selectedInstanceId
          : null;

      if (!packageId || !p) {
        return {
          key: box.key,
          title: `Box #${box.packageNumber ?? ""}`,
          isPacked: tabIsPacked,
          isStarted: false,
          content: (
            <View className="mx-4 my-4 p-4 bg-white rounded-lg border border-amber-200">
              <Text className="text-amber-800 font-medium">
                No package template is linked to the selected instance yet.
              </Text>
            </View>
          ),
        } as TabDefinition;
      }

      return {
        key: box.key,
        title: `Box #${box.packageNumber ?? ""}`,
        isPacked: tabIsPacked,
        isStarted: tabIsStarted,
        content: (
          <View>
            {box.instances.length > 1 && !box.overviewId.startsWith('legacy-overview-') && (
              <View className="mx-4 mt-3 mb-2 bg-white rounded-lg border border-gray-200 p-3">
                <Text className="text-xs font-semibold text-gray-600 mb-2">Instance</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row">
                    {box.instances.map((instance) => {
                      const isSelected = box.selectedInstanceId === instance.id;
                      return (
                        <TouchableOpacity
                          key={instance.id}
                          className={`px-3 py-1.5 rounded-full mr-2 border ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}
                          onPress={() =>
                            setSelectedInstanceByOverview((prev) => ({
                              ...prev,
                              [box.overviewId]: instance.id,
                            }))
                          }
                        >
                          <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                            #{instance.instance_number ?? '-'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            <BoxDetailsTab
              orderId={orderId}
              orderPackageId={packageId}
              orderPkgInstanceId={selectedOperationalInstanceId}
              packageNumber={box.packageNumber ?? p.package_number ?? null}
              description={box.description ?? p.description}
              info={{ original: infoOriginal, final: infoFinal }}
              dimensions={{
                internal: {
                  original: internalDimsOriginal,
                  final: internalDimsFinal,
                },
                external: {
                  original: externalDimsOriginal,
                  final: externalDimsFinal,
                },
              }}
              originalPkgInfoId={p.original_pkg_info}
              finalPkgInfoId={p.final_pkg_info}
              originalBoxTypeId={original?.box_type_id || null}
              finalBoxTypeId={final?.box_type_id || null}
              originalPackingTypeId={original?.packing_type_id || null}
              finalPackingTypeId={final?.packing_type_id || null}
              useSeiFlow={isMaintenanceFlow}
              projectType={order?.project_type || 'standard'}
              reference={p.reference ?? null}
              status={p.status}
              isOrderCompleted={order?.production_status === 'completed'}
              onStatusChange={() => loadData(false)}
              onReferenceChange={(nextReference) =>
                handleOrderPackageReferenceChange(packageId, nextReference)
              }
              onDataChange={handlePackageInfoChange}
              hasPortal={!!(order?.client as any)?.portal_settings_id}
              clientId={order?.client_id}
            />

            {/* Comments section */}
            <CommentsSection
              orderPackageId={packageId}
              editable={p.status !== "packed" && order?.production_status !== 'completed'}
            />

            <View
              className="mx-4 mt-4 mb-4"
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                sectionRefs.current["items"] = y;
              }}
            >
              <CollapsibleCard
                title={p.status === "packed" ? "Task Management (Completed)" : "Task Management"}
                containerClassName="bg-white border-gray-500"
                headerClassName=""
                contentClassName=""
                defaultOpen={true}
              >
                <OrderTasksManagement
                  orderId={orderId}
                  orderPackages={[
                    { id: packageId, package_number: box.packageNumber ?? p.package_number },
                  ]}
                  readOnly={p.status === "packed" || order?.production_status === 'completed'}
                  requirePhotoForFinish={isMaintenanceFlow}
                />
              </CollapsibleCard>
            </View>

            <>
              <View
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  sectionRefs.current["securing"] = y;
                }}
              >
                <ManufacturingSection
                  orderPackageId={packageId}
                  editTarget={isMaintenanceFlow ? "original" : "final"}
                  requireOriginalBeforeFinal={isMaintenanceFlow}
                  editable={p.status !== "packed" && order?.production_status !== 'completed'}
                  internalDimensions={{ original: internalDimsOriginal, final: internalDimsFinal }}
                />
              </View>

              <View
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  sectionRefs.current["securing-materials"] = y;
                }}
              >
                <SecuringSection
                  orderPackageId={packageId}
                  editable={p.status !== "packed" && order?.production_status !== 'completed'}
                />
              </View>

              {(() => {
                const finalId =
                  (pkgInfoMap[p.final_pkg_info || ""] as any)?.packing_type_id ||
                  null;
                const originalId =
                  (pkgInfoMap[p.original_pkg_info || ""] as any)
                    ?.packing_type_id || null;
                const hasGas = finalId
                  ? packTypeHasGas[finalId]
                  : originalId
                  ? packTypeHasGas[originalId]
                  : false;
                return hasGas ? (
                  <View>
                    <GasPackingSection
                      orderPackageId={packageId}
                      editable={p.status !== "packed" && order?.production_status !== 'completed'}
                    />
                  </View>
                ) : null;
              })()}

              {(() => {
                const finalId =
                  (pkgInfoMap[p.final_pkg_info || ""] as any)?.packing_type_id ||
                  null;
                const originalId =
                  (pkgInfoMap[p.original_pkg_info || ""] as any)
                    ?.packing_type_id || null;
                const hasVac = finalId
                  ? packTypeHasVacuum[finalId]
                  : originalId
                  ? packTypeHasVacuum[originalId]
                  : false;
                return hasVac ? (
                  <View>
                    <VacuumPackingSection
                      orderPackageId={packageId}
                      editable={p.status !== "packed" && order?.production_status !== 'completed'}
                    />
                  </View>
                ) : null;
              })()}

              <View
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  sectionRefs.current["accessories"] = y;
                }}
              >
                <AccessoriesSection
                  orderPackageId={packageId}
                  editable={p.status !== "packed" && order?.production_status !== 'completed'}
                />
              </View>

              <CoverSection
                orderPackageId={packageId}
                editable={p.status !== "packed" && order?.production_status !== 'completed'}
              />
            </>
          </View>
        ),
      } as TabDefinition;
    });

    const addTab: TabDefinition = {
      key: "add-package",
      title: (
        <View className="flex-row items-center">
          <Plus size={16} color="#0284c7" />
          <Text className="text-sky-700 font-semibold ml-1">Add Box</Text>
        </View>
      ),
      content: (
        <AddPackageTab
          orderId={orderId}
          useSeiFlow={isMaintenanceFlow}
          isMaintenanceFlow={isMaintenanceFlow}
          nextPackageNumber={
            orderPackages.length > 0
              ? Math.max(...orderPackages.map((pkg) => pkg.package_number || 0)) + 1
              : 1
          }
          onSaved={(newPackageId) => {
            void (async () => {
              await loadData(false);

              if (!newPackageId) {
                handleTabChange('list');
                return;
              }

              const { data: instanceRow } = await supabase
                .from('order_pkg_instance')
                .select('order_pkg_overview_id')
                .eq('order_package_id', newPackageId)
                .order('instance_number', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (instanceRow?.order_pkg_overview_id) {
                handleTabChange(`overview-${instanceRow.order_pkg_overview_id}`);
              } else {
                handleTabChange(newPackageId);
              }
            })();
          }}
        />
      ),
    };

    return [listTab, ...boxTabs, addTab];
  }, [
    rows,
    overviewBoxes,
    orderPackages,
    orderId,
    order?.project_type,
    pkgInfoMap,
    boxTypes,
    packingTypes,
    boxStartedMap,
    packTypeHasVacuum,
    packTypeHasGas,
    handleOrderPackageReferenceChange,
    handlePackageInfoChange,
    selectedInstanceByOverview,
  ]);

  const handleBack = () => router.back();
  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) Alert.alert("Error", "Failed to sign out");
    else router.replace("/auth/login");
  };

  const handleEndProject = () => {
    Alert.alert(
      "Complete Project",
      "Are you sure you want to end this project? We will check if all boxes are marked as completed, and if so, your team's current attendance session will be ended.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check & Complete",
          onPress: performEndProject,
        },
      ]
    );
  };

  const performEndProject = async () => {
    try {
      setLoading(true);
      if (overviewBoxes.length === 0) {
        Alert.alert("Cannot Complete", "There are no boxes in this order.");
        setLoading(false);
        return;
      }

      const unpackaged = overviewBoxes.filter((box) => {
        const hasOverviewQuantity =
          box.quantity !== null &&
          box.quantity !== undefined &&
          Number.isFinite(Number(box.quantity));
        if (hasOverviewQuantity) {
          return Number(box.quantityPacked ?? 0) < Number(box.quantity);
        }
        return box.orderPackage?.status !== 'packed';
      });

      if (unpackaged.length > 0) {
        const boxNums = unpackaged.map((box) => box.packageNumber).join(", ");
        Alert.alert("Incomplete Boxes", `Please mark all boxes as completed before ending the project.\n\nIncomplete boxes: ${boxNums}`);
        setLoading(false);
        return;
      }

      // Final validation sweep
      const packageIdsForValidation = Array.from(
        new Set(
          overviewBoxes
            .map((box) => box.orderPackage?.id)
            .filter((id): id is string => !!id)
        )
      );

      for (const packageId of packageIdsForValidation) {
        const packageNumber =
          overviewBoxes.find((box) => box.orderPackage?.id === packageId)?.packageNumber || '-';

        const { data: validation, error: vErr } = await supabase.rpc('validate_box_completion', { op_id: packageId });
        if (vErr) {
           Alert.alert("Validation Error", `Could not validate box #${packageNumber}.`);
           setLoading(false);
           return;
        }
        if (!validation?.valid) {
          Alert.alert("Incomplete Box", `Box #${packageNumber} has incomplete requirements:\n\n${!validation.materials_valid ? `\u2022 ${validation.materials_message}\n` : ''}${!validation.tasks_valid ? `\u2022 ${validation.tasks_message}\n` : ''}`);
          setLoading(false);
          return;
        }
      }

      const endIso = new Date().toISOString();

      // 1. Update project status
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ production_status: 'completed', completion_date: endIso })
        .eq('id', orderId);
        
      if (orderErr) throw orderErr;

      // 2. End attendance logs
      const { error: attErr } = await supabase
        .from('attendance_logs')
        .update({ 
          end_time: endIso, 
          updated_at: endIso 
        })
        .eq('order_id', orderId)
        .is('end_time', null);

      if (attErr) {
        console.warn("Failed to auto update attendance:", attErr);
      }

      Alert.alert("Success", "Project has been marked as fully completed!", [
        { text: "OK", onPress: () => router.replace("/(packer)/dashboard" as any) }
      ]);

    } catch (err: any) {
      Alert.alert("Error", err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  const headerFontSize =
    size === "small"
      ? 16
      : size === "large"
      ? 22
      : size === "xl"
      ? 26
      : size === "xxl"
      ? 30
      : 20;
  const titleFontSize =
    size === "small"
      ? 14
      : size === "large"
      ? 17
      : size === "xl"
      ? 19
      : size === "xxl"
      ? 22
      : 16;
  const textFontSize =
    size === "small"
      ? 13
      : size === "large"
      ? 15
      : size === "xl"
      ? 17
      : size === "xxl"
      ? 20
      : 14;
  const buttonFontSize =
    size === "small"
      ? 12
      : size === "large"
      ? 14
      : size === "xl"
      ? 16
      : size === "xxl"
      ? 18
      : 13;

  // Show loading screen for session loading or data loading
  if (sessionLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <Text className="text-lg text-gray-600">
            {sessionLoading ? "Checking session..." : "Loading packing data..."}
          </Text>
          {orderId && (
            <Text className="text-sm text-gray-500 mt-2">
              Order ID: {orderId}
            </Text>
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
            onPress={() => router.replace("/(packer)/dashboard" as any)}
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
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row justify-between items-center p-4 bg-primary-500">
          <TouchableOpacity
            onPress={handleBack}
            className="flex-row items-center"
          >
            <ArrowLeft size={24} color="#fff" />
            <Text
              style={{ fontSize: titleFontSize }}
              className="ml-2 text-white font-semibold"
            >
              Back
            </Text>
          </TouchableOpacity>
          <Text
            style={{ fontSize: headerFontSize }}
            className="text-white font-semibold"
          >
            Packing List
          </Text>
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-primary-600 px-3 py-1 rounded"
          >
            <Text style={{ fontSize: buttonFontSize }} className="text-white">
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nav buttons */}
  <NavigationButtons currentScreen="packing-list" />

        {/* Order summary */}
        {order && (
          <View className="bg-white rounded-lg border border-gray-200 m-4 p-4">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text
                  style={{ fontSize: titleFontSize }}
                  className="text-gray-800 font-semibold"
                >
                  Project: <Text className="font-bold">{order.order_name}</Text>
                </Text>
                <Text
                  style={{ fontSize: textFontSize }}
                  className="text-gray-600 mb-1"
                >
                  Client: {order.client_name}
                </Text>
                <Text
                  style={{ fontSize: textFontSize }}
                  className="text-gray-600"
                >
                  Status: <Text className="capitalize font-medium text-gray-800">{order.production_status?.replace('_', ' ') || 'Pending'}</Text>
                </Text>
              </View>
              {order.production_status !== 'completed' && (
                <TouchableOpacity
                  onPress={handleEndProject}
                  className="bg-green-600 px-4 py-3 rounded-lg flex-row items-center ml-4"
                  style={{ minHeight: 48 }}
                >
                  <Text style={{ fontSize: buttonFontSize }} className="text-white font-bold">
                    Complete Project
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text
              style={{ fontSize: textFontSize }}
              className="mt-3 text-gray-600"
            >
              Click a row or tab to view specific box details.
            </Text>
          </View>
        )}

        {/* Tabs */}
        <View
          onLayout={(event) => {
            const { y } = event.nativeEvent.layout;
            sectionRefs.current["info"] = y;
          }}
        >
          <TabLayout
            tabs={tabs}
            activeKey={activeKey}
            onChange={handleTabChange}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
