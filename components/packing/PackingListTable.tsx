import React from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';

export interface PackingRow {
  id: string;
  packageNumber: number | null;
  orderQuantity: number | null;
  equipmentName: string; // aggregated from package_items
  centerOfGravity: boolean | null;
  boxQuantity: number | null;
  boxTypeName: string;
  packingTypeName: string;
  tare: number | null;
  netWeight: number | null;
  grossWeight: number | null;
  isPacked?: boolean;
}

interface PackingListTableProps {
  rows: PackingRow[];
  onRowPress?: (rowId: string) => void;
}

const PackingListTable: React.FC<PackingListTableProps> = ({ rows, onRowPress }) => {
  const { width } = useWindowDimensions();

  // Breakpoints
  const isTiny = width < 600; // phones
  const isSmall = width >= 600 && width < 900; // small tablets/phones landscape
  const isMedium = width >= 900 && width < 1280; // tablets

  type ColKey =
    | 'box' | 'name' | 'cog' | 'boxQty' | 'boxType' | 'packType' | 'tare' | 'net' | 'gross';

  const allCols: { key: ColKey; label: string; flex: number }[] = [
    // Desired order: Box #, Box Quantity, Name, Box Type, S.E.I, Center of Gravity, Tare, Net, Gross
    { key: 'box', label: 'Box #', flex: 0.9 },
    { key: 'boxQty', label: 'Box Quantity', flex: 1.2 },
    { key: 'name', label: 'Name of Equipment', flex: 2.2 },
    { key: 'boxType', label: 'Box Type', flex: 1.6 },
    { key: 'packType', label: 'S.E.I', flex: 1.6 },
    { key: 'cog', label: 'Center of Gravity', flex: 1.2 },
    { key: 'tare', label: 'Tare', flex: 1.1 },
    { key: 'net', label: 'Net Weight', flex: 1.2 },
    { key: 'gross', label: 'Gross Weight', flex: 1.2 },
  ];

  // Always render all columns for non-tiny screens; enable horizontal scrolling when needed
  const visibleCols = allCols.map(c => c.key);
  const columns = allCols.filter(c => visibleCols.includes(c.key));

  // Scrolling layout config
  const paddingX = width < 900 ? 12 : 16;
  const minTableWidth = 1200; // ensures all columns are visible via horizontal scroll on small screens
  const tableWidth = Math.max(minTableWidth, Math.floor(width - paddingX * 2));

  const yesNo = (v: boolean | null) => (v === null || v === undefined ? '—' : v ? 'Yes' : 'No');
  const fmt = (v: number | null) => (v === 0 || v ? String(v) : '—');

  // Tiny screens: render card layout (all fields, no horizontal scroll)
  if (isTiny) {
    return (
      <View className="rounded-b-lg">
        {rows.length === 0 ? (
          <View className="py-6">
            <Text className="text-center text-gray-500">No boxes for this order.</Text>
          </View>
        ) : (
          rows.map((r, idx) => (
            <TouchableOpacity
              key={r.id}
              activeOpacity={onRowPress ? 0.7 : 1}
              onPress={() => onRowPress && onRowPress(r.id)}
              className={`m-2 p-3 rounded-lg border ${
                r.isPacked
                  ? 'bg-green-50 border-green-300'
                  : idx % 2 === 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className="text-gray-800 font-semibold mb-2">
                Box #{r.packageNumber ?? '—'}{r.isPacked ? ' ✓' : ''}
              </Text>
              <View className="flex-row flex-wrap">
                {[
                  { label: 'Name of Equipment', value: r.equipmentName || '—' },
                  { label: 'Center of Gravity', value: yesNo(r.centerOfGravity) },
                  { label: 'Box Quantity', value: fmt(r.boxQuantity) },
                  { label: 'Box Type', value: r.boxTypeName || '—' },
                  { label: 'Packing Type', value: r.packingTypeName || '—' },
                  { label: 'Tare', value: fmt(r.tare) },
                  { label: 'Net Weight', value: fmt(r.netWeight) },
                  { label: 'Gross Weight', value: fmt(r.grossWeight) },
                ].map((item) => (
                  <View key={item.label} className="w-1/2 p-1">
                    <Text className="text-gray-500 text-[11px]">{item.label}</Text>
                    <Text className="text-gray-800 text-[13px]" numberOfLines={2}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  }

  // Table layout for small/medium/large screens
  return (
    <View className="rounded-b-lg">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: paddingX }}
      >
        <View style={{ width: tableWidth }}>
          {/* Header */}
          <View className="flex-row bg-white border-b border-gray-200">
            {columns.map((c) => (
              <View key={c.key} className="px-3 py-2 border-r border-gray-200" style={{ flex: c.flex }}>
                <Text className="text-gray-700 font-semibold text-xs">{c.label}</Text>
              </View>
            ))}
          </View>

          {/* Body */}
          {rows.length === 0 ? (
            <View className="py-6">
              <Text className="text-center text-gray-500">No boxes for this order.</Text>
            </View>
          ) : (
            rows.map((r, idx) => (
              <TouchableOpacity
                key={r.id}
                activeOpacity={onRowPress ? 0.7 : 1}
                onPress={() => onRowPress && onRowPress(r.id)}
                className={`flex-row ${
                  r.isPacked
                    ? 'bg-green-50'
                    : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } border-b border-gray-100`}
              >
                {columns.map((c) => {
                  let value: string = '';
              switch (c.key) {
                    case 'box': value = r.packageNumber ?? ('—' as any); break;
                    case 'name': value = r.equipmentName || '—'; break;
                    case 'cog': value = yesNo(r.centerOfGravity); break;
                    case 'boxQty': value = fmt(r.boxQuantity); break;
                    case 'boxType': value = r.boxTypeName || '—'; break;
                    case 'packType': value = r.packingTypeName || '—'; break;
                    case 'tare': value = fmt(r.tare); break;
                    case 'net': value = fmt(r.netWeight); break;
                    case 'gross': value = fmt(r.grossWeight); break;
                  }
                  return (
                    <View key={c.key} className="px-3 py-2 border-r border-gray-200" style={{ flex: c.flex }}>
                      <Text className="text-gray-800" numberOfLines={2}>
                        {String(value)}
                      </Text>
                    </View>
                  );
                })}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default PackingListTable;
