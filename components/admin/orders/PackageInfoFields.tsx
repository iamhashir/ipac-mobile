import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { db } from "../../../utils/api/supabase";

export interface PackageInfoValue {
  description?: string;
  quantity?: number | null;
  center_of_gravity?: boolean | null;
  box_type_id?: string | null; // box_type table id
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

interface Option {
  label: string;
  value: string;
}

interface PackageInfoFieldsProps {
  value: PackageInfoValue;
  onChange: (v: PackageInfoValue) => void;
}

const Num = ({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  placeholder?: string;
  className?: string;
}) => (
  <View className={`${className || ""}`}>
    <Text className="text-xs font-medium text-gray-600 mb-0.5">{label}</Text>
    <TextInput
      value={value !== null && value !== undefined ? String(value) : ""}
      onChangeText={(t) => onChange(t.trim() === "" ? null : Number(t))}
      keyboardType="numeric"
      placeholder={placeholder || "0"}
      className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900"
    />
  </View>
);

const SelectList = ({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: Option[];
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const current = useMemo(
    () => options.find((o) => o.value === value)?.label || "Select...",
    [value, options]
  );
  return (
    <View className={`${className || ""}`}>
      <Text className="text-xs font-medium text-gray-600 mb-0.5">{label}</Text>
      <TouchableOpacity
        className="border border-gray-300 rounded px-2 py-1.5"
        onPress={() => setOpen(!open)}
      >
        <Text className="text-sm text-gray-900">{current}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView className="max-h-40 border border-gray-200 rounded mt-1">
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`px-2 py-1.5 border-b border-gray-100 ${
                value === opt.value ? "bg-blue-50" : ""
              }`}
            >
              <Text
                className={`text-xs ${
                  value === opt.value ? "text-blue-700" : "text-gray-800"
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
            className="px-2 py-1.5"
          >
            <Text className="text-xs text-gray-600">Clear</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const PackageInfoFields: React.FC<PackageInfoFieldsProps> = ({
  value,
  onChange,
}) => {
  const [boxTypes, setBoxTypes] = useState<Option[]>([]);
  const [packTypes, setPackTypes] = useState<Option[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: boxes } = await db.getAllBoxTypes();
      setBoxTypes(
        (boxes || []).map((m: any) => ({ label: m.name, value: m.id }))
      );
      const { data: pts } = await db.getAllPackingTypes();
      setPackTypes(
        (pts || []).map((t: any) => ({
          label: `${t.code} - ${t.name}`.trim(),
          value: t.id,
        }))
      );
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
    <View className="space-y-1.5">
      {/* Quantity and CoG */}
      <View className="flex-row gap-2">
        {/* <View className="flex-1">
			<span>Quantity</span>
          <Num className="bg-white" label="" value={value.quantity ?? null} onChange={(n) => onChange({ ...value, quantity: n })} />
        </View> */}
        <View className="flex-auto">
          <Text className="text-sm font-medium mb-1">
            Quantity
          </Text>
          <TextInput
            className="bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-800"
            keyboardType="numeric"
            value={value.quantity?.toString() ?? ""}
            onChangeText={(text) =>
              onChange({ ...value, quantity: Number(text) })
            }
            placeholder="Enter quantity"
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-medium text-gray-600 mb-0.5">
            Has CoG?
          </Text>
          <View className="bg-gray-50 rounded px-2 py-1.5 flex-row items-center justify-between border border-gray-200">
            <Switch
              value={!!value.center_of_gravity}
              onValueChange={(v) =>
                onChange({ ...value, center_of_gravity: v })
              }
            />
          </View>
        </View>
      </View>

      {/* Box and Packing types */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <SelectList
            label="Box Type"
            value={value.box_type_id || null}
            onChange={(v) => onChange({ ...value, box_type_id: v })}
            options={boxTypes}
          />
        </View>
        <View className="flex-1">
          <SelectList
            label="Packing"
            value={value.packing_type_id || null}
            onChange={(v) => onChange({ ...value, packing_type_id: v })}
            options={packTypes}
          />
        </View>
      </View>

      {/* Weights */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Num
            label="Tare"
            value={value.tare ?? null}
            onChange={(n) => onChange({ ...value, tare: n })}
          />
        </View>
        <View className="flex-1">
          <Num
            label="Net"
            value={value.net_weight ?? null}
            onChange={(n) => onChange({ ...value, net_weight: n })}
          />
        </View>
        <View className="flex-1">
          <Num
            label="Gross"
            value={value.gross_weight ?? null}
            onChange={(n) => onChange({ ...value, gross_weight: n })}
          />
        </View>
      </View>

      {/* Internal Dimensions */}
      <Text className="text-xs font-semibold text-gray-700 mt-1 mb-0.5">
        Internal (L×W×H)
      </Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Num
            label="L"
            value={value.internal_length ?? null}
            onChange={(n) => onChange({ ...value, internal_length: n })}
          />
        </View>
        <View className="flex-1">
          <Num
            label="W"
            value={value.internal_width ?? null}
            onChange={(n) => onChange({ ...value, internal_width: n })}
          />
        </View>
        <View className="flex-1">
          <Num
            label="H"
            value={value.internal_height ?? null}
            onChange={(n) => onChange({ ...value, internal_height: n })}
          />
        </View>
      </View>

      {/* External Dimensions */}
      <Text className="text-xs font-semibold text-gray-700 mt-1 mb-0.5">
        External (L×W×H)
      </Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Num
            label="L"
            value={value.external_length ?? null}
            onChange={(n) => onChange({ ...value, external_length: n })}
          />
        </View>
        <View className="flex-1">
          <Num
            label="W"
            value={value.external_width ?? null}
            onChange={(n) => onChange({ ...value, external_width: n })}
          />
        </View>
        <View className="flex-1">
          <Num
            label="H"
            value={value.external_height ?? null}
            onChange={(n) => onChange({ ...value, external_height: n })}
          />
        </View>
      </View>
    </View>
  );
};

export default PackageInfoFields;
