import React, { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import PackerCard, { PackerRow } from './PackerCard';

export interface OrderLaneModel {
  id: string;
  order_name: string;
  client_name?: string;
  packers: PackerRow[];
  teamLeadId?: string | null; // kept for backward compatibility
  teamLeadIds?: string[]; // new: support multiple leads
}

interface OrderLaneProps {
  order: OrderLaneModel;
  allOrders?: { id: string; order_name: string }[];
  onDropPacker?: (orderId: string, packerId: string, packerName?: string, originOrderId?: string | null) => void;
  onOpenProfile?: (packerId: string) => void;
  onMakeLead?: (orderId: string, packerId: string) => void;
  onRemoveLead?: (orderId: string, packerId: string) => void;
}

export default function OrderLane({ order, allOrders = [], onDropPacker, onOpenProfile, onMakeLead, onRemoveLead }: OrderLaneProps) {
  // Support both single and multiple leads
  const teamLeadIds = order.teamLeadIds || (order.teamLeadId ? [order.teamLeadId] : []);
  const [isOver, setIsOver] = useState(false);
  const dropProps: any = {};
  if (Platform.OS === 'web') {
    dropProps.onDragOver = (e: any) => {
      e.preventDefault();
      // Keep highlighted while pointer remains anywhere within this lane
      setIsOver(true);
    };
    dropProps.onDragEnter = (e: any) => {
      e.preventDefault();
      setIsOver(true);
    };
    dropProps.onDragLeave = (e: any) => {
      // Only remove highlight if the pointer actually left the bounding box
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (!inside) setIsOver(false);
    };
    dropProps.onDrop = (e: any) => {
      e.preventDefault();
      setIsOver(false);
      try {
        const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (payload?.packerId) onDropPacker?.(order.id, payload.packerId, payload.packerName, payload.originOrderId ?? null);
      } catch {}
    };
  }

  const emptyText = useMemo(
    () => (Platform.OS === 'web' ? 'Drag a packer here to assign' : 'No packers assigned.'),
    []
  );

  if (Platform.OS === 'web') {
    return (
      <div className="mr-0" style={{ minWidth: 300 }} {...dropProps}>
        <Card className={isOver ? 'ring-4 ring-blue-400 bg-blue-50 shadow-lg' : 'border border-gray-500 bg-white transition-colors'}>
          <CardHeader className="py-3 border-b text-lg">
            <CardTitle>{order.order_name}</CardTitle>
            {order.client_name ? <div className="text-gray-600 mt-1">{order.client_name}</div> : null}
          </CardHeader>
          <CardContent>
            {order.packers.length === 0 ? (
              <div className="text-gray-500 italic">{emptyText}</div>
            ) : (
              <div className="flex flex-row flex-wrap gap-2">
                {order.packers.map((p) => {
                  const options = [
                    { id: 'POOL', label: 'Available Packers (Unassign)' },
                    ...allOrders.filter((o) => o.id !== order.id).map((o) => ({ id: o.id, label: o.order_name }))
                  ];
                  const isLead = teamLeadIds.includes(p.id);
                  return (
                    <PackerCard
                      key={p.id}
                      packer={p}
                      draggable={true}
                      isLead={isLead}
                      originOrderId={order.id}
                      onPress={onOpenProfile}
                      onMakeLead={(pid) => {
                        if (isLead) {
                          onRemoveLead?.(order.id, pid);
                        } else {
                          onMakeLead?.(order.id, pid);
                        }
                      }}
                      moveOptions={options}
                      onMoveTo={(destId) => {
                        if (destId === 'POOL') onDropPacker?.('POOL', p.id, p.full_name, order.id);
                        else onDropPacker?.(destId, p.id, p.full_name, order.id);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <View className="mb-3" style={{ minWidth: 300 }} {...dropProps}>
      <Card>
        <CardHeader className="py-3">
          <CardTitle>
            {order.order_name}
          </CardTitle>
          {order.client_name ? (
            <Text className="text-gray-600 mt-1">{order.client_name}</Text>
          ) : null}
        </CardHeader>
        <CardContent>
          {order.packers.length === 0 ? (
            <Text className="text-gray-500">{emptyText}</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {order.packers.map((p) => {
                const options = [
                  { id: 'POOL', label: 'Available Packers (Unassign)' },
                  ...allOrders.filter((o) => o.id !== order.id).map((o) => ({ id: o.id, label: o.order_name }))
                ];
                const isLead = teamLeadIds.includes(p.id);
                return (
                  <PackerCard
                    key={p.id}
                    packer={p}
                    draggable={false}
                    isLead={isLead}
                    originOrderId={order.id}
                    onPress={onOpenProfile}
                    onMakeLead={(pid) => {
                      if (isLead) {
                        onRemoveLead?.(order.id, pid);
                      } else {
                        onMakeLead?.(order.id, pid);
                      }
                    }}
                    moveOptions={options}
                    onMoveTo={(destId) => {
                      if (destId === 'POOL') onDropPacker?.('POOL', p.id, p.full_name, order.id);
                      else onDropPacker?.(destId, p.id, p.full_name, order.id);
                    }}
                  />
                );
              })}
            </View>
          )}
        </CardContent>
      </Card>
    </View>
  );
}
