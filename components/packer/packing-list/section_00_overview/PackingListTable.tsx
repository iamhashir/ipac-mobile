import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
} from "react-native";

export interface PackingRow {
  id: string;
  packageNumber: number | null;
  orderQuantity: number | null;
  equipmentName: string; // aggregated from package_items
  centerOfGravity: boolean | null;
  centerOfGravityIsFinal?: boolean;
  boxQuantity: number | null;
  boxQuantityIsFinal?: boolean;
  boxTypeName: string;
  boxTypeIsFinal?: boolean;
  packingTypeName: string;
  packingTypeIsFinal?: boolean;
  tare: number | null;
  tareIsFinal?: boolean;
  netWeight: number | null;
  netWeightIsFinal?: boolean;
  grossWeight: number | null;
  grossWeightIsFinal?: boolean;
  isPacked?: boolean; // Box completed (blue)
  isStarted?: boolean; // Box has tasks started (green)
}

interface PackingListTableProps {
  rows: PackingRow[];
  onRowPress?: (rowId: string) => void;
}

const PackingListTable: React.FC<PackingListTableProps> = ({
  rows,
  onRowPress,
}) => {
  const { width } = useWindowDimensions();

  // Breakpoints
  const isTiny = width < 600; // phones
  const isSmall = width >= 600 && width < 900; // small tablets/phones landscape
  const isMedium = width >= 900 && width < 1280; // tablets

  // Helper to render value with source indicator (matching TwoTierEditableCard style)
  const renderValueWithIndicator = (value: string, isFinal?: boolean) => {
    if (value === "—" || isFinal === undefined) {
      return (
        <Text className="text-black text-lg text-center pt-2" numberOfLines={2}>
          {value}
        </Text>
      );
    }

    const bannerText = isFinal ? "Final" : "Original";
    const bannerBg = isFinal ? "bg-green-100" : "bg-amber-100";
    const bannerTextColor = isFinal ? "text-green-900" : "text-amber-900";

    return (
      <View>
        <Text
          className={`text-[9px] ${bannerTextColor} ${bannerBg} text-center px-1 mb-0.5 border rounded`}
        >
          {bannerText}
        </Text>
        <Text className="text-black font-semibold text-base text-center" numberOfLines={2}>
          {value}
        </Text>
      </View>
    );
  };

  type ColKey =
    | "box"
    | "name"
    | "cog"
    | "boxQty"
    | "boxType"
    | "packType"
    | "tare"
    | "net"
    | "gross";

  const allCols: { key: ColKey; label: string; flex: number }[] = [
    // Desired order: Box #, Box Quantity, Name, Box Type, S.E.I, Center of Gravity, Tare, Net, Gross
    { key: "box", label: "Box #", flex: 0.9 },
    { key: "boxQty", label: "Box Quantity", flex: 1.2 },
    { key: "name", label: "Name of Equipment", flex: 2.2 },
    { key: "boxType", label: "Box Type", flex: 1.6 },
    { key: "packType", label: "S.E.I", flex: 1.6 },
    { key: "cog", label: "Center of Gravity", flex: 1.2 },
    { key: "tare", label: "Tare", flex: 1.1 },
    { key: "net", label: "Net Weight", flex: 1.2 },
    { key: "gross", label: "Gross Weight", flex: 1.2 },
  ];

  // Always render all columns for non-tiny screens; enable horizontal scrolling when needed
  const visibleCols = allCols.map((c) => c.key);
  const columns = allCols.filter((c) => visibleCols.includes(c.key));

  // Scrolling layout config
  const paddingX = width < 900 ? 12 : 16;
  const minTableWidth = 1200; // ensures all columns are visible via horizontal scroll on small screens
  const tableWidth = Math.max(minTableWidth, Math.floor(width - paddingX * 2));

  const yesNo = (v: boolean | null) =>
    v === null || v === undefined ? "—" : v ? "Yes" : "No";
  const fmt = (v: number | null) => (v === 0 || v ? String(v) : "—");

  // Tiny screens: render card layout (all fields, no horizontal scroll)
  if (isTiny) {
    return (
      <View className="rounded-b-lg">
        {rows.length === 0 ? (
          <View className="py-6">
            <Text className="text-center text-black">
              No boxes for this order.
            </Text>
          </View>
        ) : (
          rows.map((r, idx) => (
            <TouchableOpacity
              key={r.id}
              activeOpacity={onRowPress ? 0.7 : 1}
              onPress={() => onRowPress && onRowPress(r.id)}
              className={`m-2 p-3 rounded-lg border ${
                r.isPacked
                  ? "bg-sky-200 border-sky-300"
                  : r.isStarted
                  ? "bg-lime-200 border-lime-300"
                  : idx % 2 === 0
                  ? "bg-white border-gray-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <Text className="text-black font-semibold mb-2">
                Box #{r.packageNumber ?? "—"}
                {r.isPacked ? " ✓" : ""}
              </Text>
              <View className="flex-row flex-wrap">
                {[
                  {
                    label: "Name of Equipment",
                    value: r.equipmentName || "—",
                    isFinal: undefined,
                  },
                  {
                    label: "Center of Gravity",
                    value: yesNo(r.centerOfGravity),
                    isFinal: r.centerOfGravityIsFinal,
                  },
                  {
                    label: "Box Quantity",
                    value: fmt(r.boxQuantity),
                    isFinal: r.boxQuantityIsFinal,
                  },
                  {
                    label: "Box Type",
                    value: r.boxTypeName || "—",
                    isFinal: undefined,
                  },
                  {
                    label: "Packing Type",
                    value: r.packingTypeName || "—",
                    isFinal: undefined,
                  },
                  { label: "Tare", value: fmt(r.tare), isFinal: r.tareIsFinal },
                  {
                    label: "Net Weight",
                    value: fmt(r.netWeight),
                    isFinal: r.netWeightIsFinal,
                  },
                  {
                    label: "Gross Weight",
                    value: fmt(r.grossWeight),
                    isFinal: r.grossWeightIsFinal,
                  },
                ].map((item) => (
                  <View key={item.label} className="w-1/2 p-1 border rounded">
                    <Text className="text-black text-sm font-medium text-center">
                      {item.label}
                    </Text>
                    <View className="mt-0.5">
                      {renderValueWithIndicator(item.value, item.isFinal)}
                    </View>
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
    <View className="rounded-b-lg border border-black">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: paddingX }}
      >
        <View style={{ width: tableWidth }}>
          {/* Header */}
          <View className="flex-row bg-white border-b border-black">
            {columns.map((c) => (
              <View
                key={c.key}
                className="px-3 py-2 border-r border-black"
                style={{ flex: c.flex }}
              >
                <Text className="text-black font-bold text-base text-center" numberOfLines={2}>
                  {c.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Body */}
          {rows.length === 0 ? (
            <View className="py-6">
              <Text className="text-center text-black">
                No boxes for this order.
              </Text>
            </View>
          ) : (
            rows.map((r, idx) => (
              <TouchableOpacity
                key={r.id}
                activeOpacity={onRowPress ? 0.7 : 1}
                onPress={() => onRowPress && onRowPress(r.id)}
                className={`flex-row ${
                  r.isPacked
                    ? "bg-sky-200"
                    : r.isStarted
                    ? "bg-lime-200"
                    : idx % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50"
                } border-b border-black`}
              >
                {columns.map((c) => {
                  let value: string = "";
                  let isFinal: boolean | undefined = undefined;

                  switch (c.key) {
                    case "box":
                      value = r.packageNumber ?? ("—" as any);
                      break;
                    case "name":
                      value = r.equipmentName || "—";
                      break;
                    case "cog":
                      value = yesNo(r.centerOfGravity);
                      isFinal = r.centerOfGravityIsFinal;
                      break;
                    case "boxQty":
                      value = fmt(r.boxQuantity);
                      isFinal = r.boxQuantityIsFinal;
                      break;
                    case "boxType":
                      value = r.boxTypeName || "—";
                      isFinal = undefined;
                      break;
                    case "packType":
                      value = r.packingTypeName || "—";
                      isFinal = undefined;
                      break;
                    case "tare":
                      value = fmt(r.tare);
                      isFinal = r.tareIsFinal;
                      break;
                    case "net":
                      value = fmt(r.netWeight);
                      isFinal = r.netWeightIsFinal;
                      break;
                    case "gross":
                      value = fmt(r.grossWeight);
                      isFinal = r.grossWeightIsFinal;
                      break;
                  }

                  return (
                    <View
                      key={c.key}
                      className="px-3 py-2 border-r border-black"
                      style={{ flex: c.flex }}
                    >
                      {renderValueWithIndicator(value, isFinal)}
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
