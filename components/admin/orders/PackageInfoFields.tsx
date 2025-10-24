import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert, Switch } from 'react-native';
import { db } from '../../../utils/api/supabase';

export interface PackageInfoValue {
  description?: string;
  quantity?: number | null;
  center_of_gravity?: boolean | null;
  box_type_id?: string | null; // material id for now
  packing_type_id?: string | null;
  tare?: number | null;
  net_weight?: number | null;
  gross_weight?: number | null; // computed
  internal_length?: number | null;
  internal_width?: number | null;
  internal_height?: number | null;
  external_length?: number | null;
  external_width?: number | null;
  external_height?: number | null;
}

interface Option { label: string; value: string; }

interface PackageInfoFieldsProps {
  value: PackageInfoValue;
  onChange: (v: PackageInfoValue) => void;
}

const Num = ({ label, value, onChange, placeholder, className }: { label: string; value: number | null | undefined; onChange: (n: number | null) => void; placeholder?: string; className?: string }) => (
  <View className={`mb-3 ${className || ''}`}>
    <Text className="text-xs font-medium text-gray-700 mb-1">{label}</Text>
    <TextInput
      value={value !== null && value !== undefined ? String(value) : ''}
      onChangeText={(t) => onChange(t.trim() === '' ? null : Number(t))}
      keyboardType="numeric"
      placeholder={placeholder || '0'}
      className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
    />
  </View>
);

const SelectList = ({ label, value, onChange, options, className }: { label: string; value: string | null | undefined; onChange: (v: string | null) => void; options: Option[]; className?: string }) => {
  const [open, setOpen] = useState(false);
  const current = useMemo(() => options.find(o => o.value === value)?.label || 'Select...', [value, options]);
  return (
    <View className={`mb-3 ${className || ''}`}>
      <Text className="text-xs font-medium text-gray-700 mb-1">{label}</Text>
      <TouchableOpacity className="border border-gray-300 rounded-lg px-3 py-2" onPress={() => setOpen(!open)}>
        <Text className="text-gray-900">{current}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView className="max-h-40 border border-gray-200 rounded-lg mt-2">
          {options.map((opt) => (
            <TouchableOpacity key={opt.value} onPress={() => { onChange(opt.value); setOpen(false); }} className={`px-3 py-2 border-b border-gray-100 ${value === opt.value ? 'bg-blue-50' : ''}`}>
              <Text className={`text-sm ${value === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { onChange(null); setOpen(false); }} className="px-3 py-2">
            <Text className="text-sm text-gray-600">Clear</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const PackageInfoFields: React.FC<PackageInfoFieldsProps> = ({ value, onChange }) => {
  const [materials, setMaterials] = useState<Option[]>([]);
  const [packTypes, setPackTypes] = useState<Option[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: mats } = await db.getAllMaterials();
      setMaterials((mats || []).map((m: any) => ({ label: m.name, value: m.id })));
      const { data: pts } = await db.getAllPackingTypes();
      setPackTypes((pts || []).map((t: any) => ({ label: `${t.code} - ${t.name}`.trim(), value: t.id })));
    };
    load();
  }, []);

  // Compute gross on the fly
  useEffect(() => {
    const tare = value.tare || 0;
    const net = value.net_weight || 0;
    const gross = tare + net;
    if (gross !== (value.gross_weight || 0)) {
      onChange({ ...value, gross_weight: gross });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.tare, value.net_weight]);

  return (
    <View>
      {/* Quantity and CoG */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Num label="Quantity of boxes" value={value.quantity ?? null} onChange={(n) => onChange({ ...value, quantity: n })} />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-medium text-gray-700 mb-1">Center of Gravity</Text>
          <View className="bg-gray-100 rounded-lg px-3 py-2 flex-row items-center justify-between">
            <Text className="text-gray-800">Has CoG?</Text>
            <Switch value={!!value.center_of_gravity} onValueChange={(v) => onChange({ ...value, center_of_gravity: v })} />
          </View>
        </View>
      </View>

      {/* Box and Packing types */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <SelectList label="Box Type (material)" value={value.box_type_id || null} onChange={(v) => onChange({ ...value, box_type_id: v })} options={materials} />
        </View>
        <View className="flex-1">
          <SelectList label="Packing Type" value={value.packing_type_id || null} onChange={(v) => onChange({ ...value, packing_type_id: v })} options={packTypes} />
        </View>
      </View>

      {/* Weights */}
      <View className="flex-row gap-3">
        <View className="flex-1"><Num label="Tare (kg)" value={value.tare ?? null} onChange={(n) => onChange({ ...value, tare: n })} /></View>
        <View className="flex-1"><Num label="Net (kg)" value={value.net_weight ?? null} onChange={(n) => onChange({ ...value, net_weight: n })} /></View>
        <View className="flex-1"><Num label="Gross (kg)" value={value.gross_weight ?? null} onChange={(n) => onChange({ ...value, gross_weight: n })} /></View>
      </View>

      {/* Internal Dimensions */}
      <Text className="text-xs font-semibold text-gray-800 mt-2 mb-1">Internal Dimensions (L x W x H)</Text>
      <View className="flex-row gap-3">
        <View className="flex-1"><Num label="Length" value={value.internal_length ?? null} onChange={(n) => onChange({ ...value, internal_length: n })} /></View>
        <View className="flex-1"><Num label="Width" value={value.internal_width ?? null} onChange={(n) => onChange({ ...value, internal_width: n })} /></View>
        <View className="flex-1"><Num label="Height" value={value.internal_height ?? null} onChange={(n) => onChange({ ...value, internal_height: n })} /></View>
      </View>

      {/* External Dimensions */}
      <Text className="text-xs font-semibold text-gray-800 mt-2 mb-1">External Dimensions (L x W x H)</Text>
      <View className="flex-row gap-3">
        <View className="flex-1"><Num label="Length" value={value.external_length ?? null} onChange={(n) => onChange({ ...value, external_length: n })} /></View>
        <View className="flex-1"><Num label="Width" value={value.external_width ?? null} onChange={(n) => onChange({ ...value, external_width: n })} /></View>
        <View className="flex-1"><Num label="Height" value={value.external_height ?? null} onChange={(n) => onChange({ ...value, external_height: n })} /></View>
      </View>
    </View>
  );
};

export default PackageInfoFields;
