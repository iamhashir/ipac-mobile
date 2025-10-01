import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { Card, CardContent } from '../../ui/Card';
import Badge from '../../ui/Badge';

export interface PackerRow {
  id: string;
  full_name: string;
  username?: string | null;
  packer_status?: 'available' | 'busy' | 'unavailable' | string;
  current_order_id?: string | null;
}

interface PackerCardProps {
  packer: PackerRow;
  draggable?: boolean;
  isLead?: boolean;
  originOrderId?: string | null;
  onPress?: (id: string) => void;
  onMakeLead?: (packerId: string) => void;
}

const statusClasses = (s?: string) => {
  switch (s) {
    case 'available':
      return 'bg-green-50 border-green-300 text-green-800';
    case 'busy':
      return 'bg-red-50 border-red-300 text-red-800';
    default:
      return 'bg-gray-50 border-gray-300 text-gray-700';
  }
};

export default function PackerCard({ packer, draggable = Platform.OS === 'web', isLead = false, originOrderId = null, onPress, onMakeLead }: PackerCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragProps: any = {};
  if (Platform.OS === 'web' && draggable) {
    dragProps.draggable = true;
    dragProps.onDragStart = (e: any) => {
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify({ packerId: packer.id, packerName: packer.full_name, originOrderId }));
      } catch {}
      setIsDragging(true);
    };
    dragProps.onDragEnd = () => setIsDragging(false);
  }

  const inOrder = !!originOrderId;
  if (Platform.OS === 'web') {
    return (
      <div {...dragProps} style={{ width: 300, minWidth: 260, opacity: isDragging ? 1 : undefined }} className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}>
        <Card className={`transition hover:shadow-sm border-gray-400 hover:border-blue-300 ${isDragging ? 'ring-2 ring-blue-500 bg-blue-100 shadow-xl' : 'bg-white hover:bg-blue-50'}`}>
          <CardContent className="py-3">
            {/* Header row: name + action/badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="text-gray-900 font-semibold truncate" title={packer.full_name} onClick={() => onPress?.(packer.id)}>
                {packer.full_name}
              </div>
              {inOrder ? (
                isLead ? (
                  <Badge variant="secondary">Team Lead</Badge>
                ) : (
                  <button
                    className="px-2 py-1 text-xs rounded border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100"
                    onClick={(e) => { e.stopPropagation(); onMakeLead?.(packer.id); }}
                  >
                    Make Lead
                  </button>
                )
              ) : null}
            </div>
            {/* Status badge */}
            <div className="mt-2">
              <Badge variant="outline" className={statusClasses(packer.packer_status)}>
                {packer.packer_status || 'unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <View {...dragProps} style={{ maxWidth: 280, minWidth: 220 }}>
      <Card>
        <CardContent className="py-3">
          {/* Header row: name + action/badge */}
          <View className="flex-row items-center justify-between">
            <TouchableOpacity activeOpacity={0.8} onPress={() => onPress?.(packer.id)} className="flex-1 mr-2">
              <Text className="text-gray-900 font-semibold" numberOfLines={1}>{packer.full_name}</Text>
            </TouchableOpacity>
            {inOrder ? (
              isLead ? (
                <Badge variant="secondary">Team Lead</Badge>
              ) : (
                <TouchableOpacity onPress={() => onMakeLead?.(packer.id)} className="px-2 py-1 rounded border border-blue-600">
                  <Text className="text-blue-700 text-xs">Make Lead</Text>
                </TouchableOpacity>
              )
            ) : null}
          </View>
          {/* Status badge */}
          <View className="flex-row mt-2">
            <Badge variant="outline" className={statusClasses(packer.packer_status)}>{packer.packer_status || 'unknown'}</Badge>
          </View>
        </CardContent>
      </Card>
    </View>
  );
}