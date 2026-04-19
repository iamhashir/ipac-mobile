import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Check, X, Camera } from "lucide-react-native";
import { formatNumeric, type MaterialsRowFlex } from "./OrderPackageMaterialsSection.types";

export interface MaterialsColumn {
  key: string;
  label: string;
  flex: number;
  render?: (row: any) => React.ReactNode;
}

interface MaterialsHeaderRowProps {
  quantityLabel: string;
  additionalColumns: MaterialsColumn[];
  showDimensions: boolean;
  showComment: boolean;
  cameraEnabled: boolean;
  flexMap: MaterialsRowFlex;
}

interface MaterialsDataRowProps {
  row: any;
  additionalColumns: MaterialsColumn[];
  showDimensions: boolean;
  showComment: boolean;
  cameraEnabled: boolean;
  flexMap: MaterialsRowFlex;
  unitsMap: Record<string, string>;
  variantLabelForRow: (row: any) => string;
  formatDimensionValue: (value: any) => string;
  openCommentModal: (row: any) => void;
  hideUseButton: boolean;
  hideRemoveButton: boolean;
  isEditable: boolean;
  markUsed: (id: string) => void;
  removeRow: (id: string) => void;
  handleCameraPress: (row: any) => void;
}

export const MaterialsHeaderRow: React.FC<MaterialsHeaderRowProps> = ({
  quantityLabel,
  additionalColumns,
  showDimensions,
  showComment,
  cameraEnabled,
  flexMap,
}) => {
  return (
    <View className="flex-row items-center bg-white/70 border border-gray-300 rounded px-2 py-2">
      <View style={{ flex: flexMap.item }}>
        <Text className="text-xs font-semibold text-gray-700">Item</Text>
      </View>

      <View style={{ flex: flexMap.quantity }}>
        <Text className="text-xs font-semibold text-gray-700">{quantityLabel}</Text>
      </View>

      {additionalColumns.map((col) => (
        <View key={col.key} style={{ flex: col.flex }}>
          <Text className="text-xs font-semibold text-gray-700">{col.label}</Text>
        </View>
      ))}

      <View style={{ flex: flexMap.unit }}>
        <Text className="text-xs font-semibold text-gray-700">Unit</Text>
      </View>

      {showDimensions && (
        <>
          <View style={{ flex: flexMap.length }}>
            <Text className="text-xs font-semibold text-gray-700">Len</Text>
          </View>
          <View style={{ flex: flexMap.width }}>
            <Text className="text-xs font-semibold text-gray-700">Wid</Text>
          </View>
        </>
      )}

      {showComment && (
        <View style={{ flex: flexMap.comment }}>
          <Text className="text-xs font-semibold text-gray-700">Comment</Text>
        </View>
      )}

      <View style={{ flex: flexMap.actions }}>
        <Text className="text-xs font-semibold text-gray-700">Item Used</Text>
      </View>

      {cameraEnabled && (
        <View style={{ flex: flexMap.camera }}>
          <Text className="text-xs font-semibold text-gray-700 text-center">Photo</Text>
        </View>
      )}
    </View>
  );
};

export const MaterialsDataRow: React.FC<MaterialsDataRowProps> = ({
  row,
  additionalColumns,
  showDimensions,
  showComment,
  cameraEnabled,
  flexMap,
  unitsMap,
  variantLabelForRow,
  formatDimensionValue,
  openCommentModal,
  hideUseButton,
  hideRemoveButton,
  isEditable,
  markUsed,
  removeRow,
  handleCameraPress,
}) => {
  const hasComment = typeof row.comment === "string" && row.comment.trim().length > 0;

  return (
    <View className="flex-row items-center bg-white border border-gray-200 rounded px-2 py-2 mt-1">
      <View style={{ flex: flexMap.item }}>
        <Text className="text-sm text-gray-800" numberOfLines={1}>
          {variantLabelForRow(row)}
        </Text>
      </View>

      <View style={{ flex: flexMap.quantity }}>
        <Text className="text-sm text-gray-800">{formatNumeric(row.quantity)}</Text>
      </View>

      {additionalColumns.map((col) => (
        <View key={col.key} style={{ flex: col.flex }}>
          {col.render ? (
            col.render(row)
          ) : (
            <Text className="text-sm text-gray-800">{formatNumeric(row[col.key])}</Text>
          )}
        </View>
      ))}

      <View style={{ flex: flexMap.unit }}>
        <Text className="text-sm text-gray-800">
          {row.unit_id ? unitsMap[row.unit_id as string] || "—" : "—"}
        </Text>
      </View>

      {showDimensions && (
        <>
          <View style={{ flex: flexMap.length }}>
            <Text className="text-sm text-gray-800">{formatDimensionValue(row.length)}</Text>
          </View>
          <View style={{ flex: flexMap.width }}>
            <Text className="text-sm text-gray-800">{formatDimensionValue(row.width)}</Text>
          </View>
        </>
      )}

      {showComment && (
        <View style={{ flex: flexMap.comment }} className="items-center">
          <TouchableOpacity
            onPress={() => openCommentModal(row)}
            disabled={!hasComment}
            className={`px-3 py-1 rounded-full border flex-row items-center gap-1 ${
              hasComment ? "bg-blue-50 border-blue-500" : "bg-gray-100 border-gray-300"
            }`}
          >
            <View className={`w-2 h-2 rounded-full ${hasComment ? "bg-blue-600" : "bg-gray-400"}`} />
            <Text
              className={`text-xs font-semibold ${
                hasComment ? "text-blue-700" : "text-gray-400"
              }`}
            >
              {hasComment ? "View" : "No Notes"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flex: flexMap.actions, paddingRight: 12 }}>
        <View className="flex-row gap-2 flex-wrap items-center justify-start">
          {!hideUseButton && !row.item_used ? (
            <TouchableOpacity
              disabled={!isEditable}
              onPress={() => markUsed(row.id)}
              className={`px-2 py-1 rounded border ${
                isEditable ? "bg-green-50 border-green-600" : "bg-gray-100 border-gray-300"
              }`}
            >
              <View className="flex-row items-center">
                <Check size={18} color={isEditable ? "#15803d" : "#9ca3af"} />
                <Text
                  className={`text-xs ml-1 ${
                    isEditable ? "text-green-700" : "text-gray-400"
                  }`}
                >
                  Use
                </Text>
              </View>
            </TouchableOpacity>
          ) : !hideUseButton && row.item_used ? (
            <View className="px-2 py-1 rounded bg-gray-100 border border-gray-300">
              <View className="flex-row items-center">
                <Check size={18} color="#6b7280" />
                <Text className="text-gray-600 text-xs ml-1">Used</Text>
              </View>
            </View>
          ) : null}

          {!hideRemoveButton && (
            <TouchableOpacity
              disabled={!isEditable}
              onPress={() => removeRow(row.id)}
              className={`px-2 py-1 rounded border ${
                isEditable ? "bg-red-50 border-red-600" : "bg-gray-100 border-gray-300"
              }`}
            >
              <View className="flex-row items-center">
                <X size={18} color={isEditable ? "#ff0000" : "#9ca3af"} />
                <Text
                  className={`text-xs ml-1 ${
                    isEditable ? "text-red-800" : "text-gray-400"
                  }`}
                >
                  Remove
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {cameraEnabled && (
        <View style={{ flex: flexMap.camera }} className="items-center justify-center">
          <TouchableOpacity
            onPress={() => handleCameraPress(row)}
            className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border ${
              isEditable ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-100 opacity-60"
            }`}
            activeOpacity={0.7}
            disabled={!isEditable}
          >
            <Camera size={16} color={isEditable ? "#2563eb" : "#9ca3af"} />
            <Text
              className={`text-xs font-semibold ${
                isEditable ? "text-blue-700" : "text-gray-400"
              }`}
            >
              Photo
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
