import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { createPortal } from "react-dom";
import { db } from "../../../utils/api/supabase";
import teamLeadApi from "../../../utils/api/teamLead";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/Card";
import OrderLane, { OrderLaneModel } from "./OrderLane";
import PackerCard, { PackerRow } from "./PackerCard";
import { ConfirmModal } from "../../ui/ConfirmModal";
import { useRouter } from "expo-router";

export default function AssignmentsBoard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allPackers, setAllPackers] = useState<PackerRow[]>([]);
  const [orders, setOrders] = useState<OrderLaneModel[]>([]);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    packerId?: string;
    orderId?: string;
    packerName?: string;
    orderName?: string;
    originOrderId?: string | null;
  }>({ open: false });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [{ data: packerRows }, { data: orderRows }] = await Promise.all([
          db.getAllPackersWithStatus(),
          db.getAvailableOrders(),
        ]);

        const packers: PackerRow[] = (packerRows as any) || [];
        setAllPackers(packers);

        const ordersBase = ((orderRows as any) || []).map((o: any) => ({
          id: o.id,
          order_name: o.order_name,
          client_name: o.client_name,
        })) as OrderLaneModel[];

        // Fetch team members + lead flags for all orders in one batch query
        const { data: teamRows } = await db.getTeamMembersForOrders(
          ordersBase.map((o) => o.id)
        );
        const membersByOrder = new Map<string, any[]>();
        ((teamRows as any) || []).forEach((row: any) => {
          const list = membersByOrder.get(row.order_id) || [];
          list.push(row);
          membersByOrder.set(row.order_id, list);
        });

        const withTeams = ordersBase.map((o) => {
          const rows = membersByOrder.get(o.id) || [];
          const packersForOrder: PackerRow[] = rows.map((m: any) => ({
            id: m.packer_id,
            full_name: m.profiles?.full_name || "",
            username: m.profiles?.username || null,
            packer_status: "busy",
          }));
          const teamLeadIds = rows
            .filter((m: any) => m.is_team_lead)
            .map((m: any) => m.packer_id);
          const teamLeadId = teamLeadIds.length > 0 ? teamLeadIds[0] : null; // for backward compatibility
          return {
            ...o,
            packers: packersForOrder,
            teamLeadId,
            teamLeadIds,
          } as OrderLaneModel;
        });

        setOrders(withTeams);
      } catch (e: any) {
        setError(e?.message || "Failed to load assignments");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const unassignedPackers = useMemo(() => {
    const assignedIds = new Set<string>();
    orders.forEach((o) => o.packers.forEach((p) => assignedIds.add(p.id)));
    return allPackers.filter((p) => !assignedIds.has(p.id));
  }, [orders, allPackers]);

  const moveOptions = useMemo(
    () => orders.map((o) => ({ id: o.id, label: o.order_name })),
    [orders]
  );

  const openProfile = useCallback(
    (id: string) => router.push(`/(admin)/users/${id}`),
    [router]
  );

  const handleMakeLead = useCallback(async (orderId: string, packerId: string) => {
    const { error } = await teamLeadApi.addTeamLead(orderId, packerId);
    if (error) setError(error.message || "Failed to add lead");
    else
      setOrders((prev) =>
        prev.map((ord) =>
          ord.id === orderId
            ? {
                ...ord,
                teamLeadIds: [...(ord.teamLeadIds || []), packerId],
                teamLeadId: ord.teamLeadId || packerId,
              }
            : ord
        )
      );
  }, []);

  const handleRemoveLead = useCallback(async (orderId: string, packerId: string) => {
    const { error } = await teamLeadApi.removeTeamLead(orderId, packerId);
    if (error) setError(error.message || "Failed to remove lead");
    else
      setOrders((prev) =>
        prev.map((ord) => {
          if (ord.id === orderId) {
            const newLeadIds = (ord.teamLeadIds || []).filter((id) => id !== packerId);
            return {
              ...ord,
              teamLeadIds: newLeadIds,
              teamLeadId: newLeadIds.length > 0 ? newLeadIds[0] : null,
            };
          }
          return ord;
        })
      );
  }, []);

  const requestAssign = (
    orderId: string,
    packerId: string,
    packerName?: string,
    originOrderId?: string | null
  ) => {
    const packer =
      allPackers.find((p) => p.id === packerId) ||
      (packerName ? ({ full_name: packerName } as any) : undefined);
    const order = orders.find((o) => o.id === orderId);
    setConfirm({
      open: true,
      packerId,
      orderId,
      packerName: packer?.full_name,
      orderName: order?.order_name,
      originOrderId: originOrderId ?? null,
    });
  };

  const confirmAssign = async () => {
    const packerId = confirm.packerId;
    if (!packerId) {
      setConfirm({ open: false });
      return;
    }

    // Unassign to pool
    if (confirm.orderId === "POOL" && confirm.originOrderId) {
      const origin = orders.find((o) => o.id === confirm.originOrderId);
      if (!origin) return setConfirm({ open: false });
      const originIds = origin.packers
        .map((p) => p.id)
        .filter((id) => id !== packerId);
      const { error } = await db.assignPackersToOrder(origin.id, originIds);
      if (error) setError(error.message || "Failed to unassign");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === origin.id
            ? {
                ...o,
                packers: o.packers.filter((p) => p.id !== packerId),
              }
            : o
        )
      );
      setAllPackers((prev) =>
        prev.map((p) =>
          p.id === packerId ? { ...p, packer_status: "available" } : p
        )
      );
      setConfirm({ open: false });
      return;
    }

    if (!confirm.orderId) return setConfirm({ open: false });
  const target = orders.find((o) => o.id === confirm.orderId);
    if (!target) return setConfirm({ open: false });

    // Move between orders
    if (confirm.originOrderId && confirm.originOrderId !== confirm.orderId) {
      const origin = orders.find((o) => o.id === confirm.originOrderId);
      if (origin) {
        const originIds = origin.packers
          .map((p) => p.id)
          .filter((id) => id !== packerId);
        await db.assignPackersToOrder(origin.id, originIds);
      }
  const targetIds = [...target.packers.map((p) => p.id), packerId];
      const { error } = await db.assignPackersToOrder(target.id, targetIds);
      if (error) setError(error.message || "Failed to move packer");
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === target.id)
            return {
              ...o,
              packers: [
                ...o.packers,
                {
                  id: packerId,
                  full_name:
                    confirm.packerName ||
                    allPackers.find((p) => p.id === packerId)
                      ?.full_name ||
                    "—",
                  packer_status: "busy",
                },
              ],
            };
          if (o.id === confirm.originOrderId)
            return {
              ...o,
              packers: o.packers.filter((p) => p.id !== packerId),
            };
          return o;
        })
      );
      setConfirm({ open: false });
      return;
    }

    // Assign from pool -> order
    const existing = target.packers.map((p) => p.id);
  if (existing.includes(packerId)) {
      setConfirm({ open: false });
      return;
    }
  const newIds = [...existing, packerId];
    const { error } = await db.assignPackersToOrder(target.id, newIds);
    if (error) {
      setError(error.message || "Failed to assign packer");
    } else {
  const added = allPackers.find((p) => p.id === packerId);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === target.id
            ? {
                ...o,
                packers: [
                  ...o.packers,
                  {
                    id: added?.id || packerId,
                    full_name: added?.full_name || "—",
                    packer_status: "busy",
                  },
                ],
              }
            : o
        )
      );
      setAllPackers((prev) =>
        prev.map((p) =>
          p.id === packerId ? { ...p, packer_status: "busy" } : p
        )
      );
    }
    setConfirm({ open: false });
  };

  const [dragging, setDragging] = useState(false);
  const [edge, setEdge] = useState<"none" | "top" | "bottom">("none");
  const containerSentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let rafId: number | null = null;
    const onDragStart = () => setDragging(true);
    const onDragEnd = () => {
      setDragging(false);
      setEdge("none");
      if (rafId) cancelAnimationFrame(rafId);
    };
    const onDragOver = (e: any) => {
      e.preventDefault();
      // Threshold relative to viewport for consistent behavior across layouts
      const viewportH = window.innerHeight;
      const threshold = Math.max(220, Math.floor(viewportH * 0.25));
      const speed = Math.max(60, Math.floor(viewportH * 0.06));
      const y = e.clientY;
      if (y > viewportH - threshold) {
        setEdge("bottom");
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => window.scrollBy({ top: speed, behavior: "auto" }));
      } else if (y < threshold) {
        setEdge("top");
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => window.scrollBy({ top: -speed, behavior: "auto" }));
      } else {
        setEdge("none");
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    };
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    document.addEventListener("drop", onDragEnd);
    document.addEventListener("dragover", onDragOver);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("drop", onDragEnd);
      document.removeEventListener("dragover", onDragOver);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <View className="mt-4">
      {/* Top stats */}
      <View className="flex-row mb-5">
        <Card className="flex-1 bg-blue-50 border border-blue-600">
          <CardContent className="py-3 px-4 flex justify-center items-center gap-2">
            <Text className="text-xl text-blue-700 font-bold">
              Total Packers:
            </Text>
            <Text className="text-2xl font-bold text-blue-900">
              {allPackers.length}
            </Text>
          </CardContent>
        </Card>
        <View className="w-2" />
        <Card className="flex-1 bg-amber-50 border border-amber-600">
          <CardContent className="py-3 px-4 flex justify-center items-center gap-2">
            <Text className="text-xl font-bold text-amber-700">
              Working Now:
            </Text>
            <Text className="text-2xl font-bold text-amber-900">
              {allPackers.filter((p) => p.packer_status === "busy").length}
            </Text>
          </CardContent>
        </Card>
        <View className="w-2" />
        <Card className="flex-1 bg-green-50 border border-green-600">
          <CardContent className="py-3 px-4 flex justify-center items-center gap-2">
            <Text className="text-xl font-bold text-green-700">Available:</Text>
            <Text className="text-2xl font-bold text-green-900">
              {allPackers.filter((p) => p.packer_status === "available").length}
            </Text>
          </CardContent>
        </Card>
      </View>

      
      {Platform.OS === 'web' && dragging && (
        createPortal(
          <>
            {/* Viewport-fixed overlays ensure they always sit at the real screen edges */}
            <div className={`fixed left-0 right-0 top-0 h-32 pointer-events-none transition-opacity z-[9999] ${edge === 'top' ? 'opacity-100' : 'opacity-60'}`} style={{background: 'linear-gradient(to bottom, rgba(59,130,246,0.7), rgba(59,130,246,0))'}} />
            <div className={`fixed left-0 right-0 bottom-0 h-32 pointer-events-none transition-opacity z-[9999] ${edge === 'bottom' ? 'opacity-100' : 'opacity-60'}`} style={{background: 'linear-gradient(to top, rgba(59,130,246,0.7), rgba(59,130,246,0))'}} />
          </>,
          document.body
        )
      )}

      {/* Unassigned packers pool */}
      <Card className="border border-gray-500 bg-teal-50">
        <CardHeader className="py-3 text-xl border-b border-gray-300 border-dashed">
          <CardTitle>
            Available Packers
            <Text className="px-4 text-gray-700">
              drag packers to any order to assign them
            </Text>
          </CardTitle>
        </CardHeader>
        <CardContent
          {...(Platform.OS === "web"
            ? {
                onDragOver: (e: any) => e.preventDefault(),
                onDrop: (e: any) => {
                  e.preventDefault();
                  try {
                    const payload = JSON.parse(
                      e.dataTransfer.getData("text/plain")
                    );
                    if (payload?.packerId && payload?.originOrderId) {
                      requestAssign(
                        "POOL",
                        payload.packerId,
                        payload.packerName,
                        payload.originOrderId
                      );
                    }
                  } catch {}
                },
              }
            : {})}
        >
          {unassignedPackers.length === 0 ? (
            <Text className="text-gray-600">
              All packers are already assigned.
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {unassignedPackers.map((p) => (
                <PackerCard
                  key={p.id}
                  packer={p}
                  onPress={openProfile}
                  moveOptions={moveOptions}
                  onMoveTo={(destId) => requestAssign(destId, p.id, p.full_name, null)}
                />
              ))}
            </View>
          )}
          {Platform.OS !== "web" && (
            <Text className="text-gray-500 mt-2">
              Tip: Drag & drop is available on web. On mobile, open a packer and
              assign from the order page.
            </Text>
          )}
        </CardContent>
      </Card>

      {/* Orders lanes */}
      <Card className="mt-5 border border-gray-500 bg-cyan-50 text-xl">
        <CardHeader className="py-3">
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <Text className="text-red-600">{error}</Text> : null}
          {loading ? (
            <Text className="text-gray-600">Loading…</Text>
          ) : orders.length === 0 ? (
            <Text className="text-gray-600">No active orders.</Text>
          ) : Platform.OS === "web" ? (
            <div className="flex flex-col gap-4">
              {orders.map((o) => (
                <OrderLane
                  key={o.id}
                  order={o}
                  allOrders={orders}
                  onDropPacker={requestAssign}
                  onOpenProfile={openProfile}
                  onMakeLead={handleMakeLead}
                  onRemoveLead={handleRemoveLead}
                />
              ))}
            </div>
          ) : (
            <View className="flex-col">
              {orders.map((o) => (
                <OrderLane
                  key={o.id}
                  order={o}
                  allOrders={orders}
                  onDropPacker={requestAssign}
                  onOpenProfile={openProfile}
                  onMakeLead={handleMakeLead}
                  onRemoveLead={handleRemoveLead}
                />
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        visible={confirm.open}
        title="Assign packer"
        description={`Add ${confirm.packerName || "this packer"} to order ${
          confirm.orderName || ""
        }?`}
        confirmText="Assign"
        cancelText="Cancel"
        onCancel={() => setConfirm({ open: false })}
        onConfirm={confirmAssign}
      />
    </View>
  );
}
