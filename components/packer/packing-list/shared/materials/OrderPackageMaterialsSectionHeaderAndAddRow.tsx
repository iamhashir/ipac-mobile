import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Keyboard,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
import {
  type AdditionalFieldConfig,
  type MaterialsRowFlex,
} from "./OrderPackageMaterialsSection.types";

interface OrderPackageMaterialsSectionHeaderAndAddRowProps {
  title: string;
  hideInnerSectionTitle: boolean;
  isEditable: boolean;
  addOpen: boolean;
  addButtonLabel: string;
  quantityPlaceholder: string;
  showDimensions: boolean;
  showComment: boolean;
  cameraEnabled: boolean;
  flexMap: MaterialsRowFlex;
  additionalFields: AdditionalFieldConfig[];
  additionalValues: Record<string, string>;
  errors: Record<string, string | undefined>;
  formVariant: string | null;
  formIsPending: boolean;
  pendingFormLabel: string;
  formQuantity: string;
  formUnit: string | null;
  formLength: string;
  formWidth: string;
  formComment: string;
  unitsMap: Record<string, string>;
  variantTriggerRef: React.RefObject<any>;
  unitTriggerRef: React.RefObject<any>;
  variantLabelById: (id: string | null | undefined) => string;
  onToggleAdd: () => void;
  onToggleVariantPicker: () => void;
  onToggleUnitPicker: () => void;
  onQuantityChange: (value: string) => void;
  onAdditionalChange: (key: string, value: string) => void;
  onLengthChange: (value: string) => void;
  onWidthChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onCancelAdd: () => void;
  onSave: () => void;
  isSaving: boolean;
}

const OrderPackageMaterialsSectionHeaderAndAddRow: React.FC<
  OrderPackageMaterialsSectionHeaderAndAddRowProps
> = ({
  title,
  hideInnerSectionTitle,
  isEditable,
  addOpen,
  addButtonLabel,
  quantityPlaceholder,
  showDimensions,
  showComment,
  cameraEnabled,
  flexMap,
  additionalFields,
  additionalValues,
  errors,
  formVariant,
  formIsPending,
  pendingFormLabel,
  formQuantity,
  formUnit,
  formLength,
  formWidth,
  formComment,
  unitsMap,
  variantTriggerRef,
  unitTriggerRef,
  variantLabelById,
  onToggleAdd,
  onToggleVariantPicker,
  onToggleUnitPicker,
  onQuantityChange,
  onAdditionalChange,
  onLengthChange,
  onWidthChange,
  onCommentChange,
  onCancelAdd,
  onSave,
  isSaving,
}) => {
  return (
    <>
      <View
        className={`flex-row items-center mb-2 ${
          hideInnerSectionTitle ? "justify-end" : "justify-between"
        }`}
      >
        {!hideInnerSectionTitle && (
          <Text className="text-gray-800 font-semibold">{title}</Text>
        )}
        <View className="flex-row items-center gap-2">
          {!isEditable && (
            <Text className="text-xs text-gray-500">Editing locked</Text>
          )}
          <TouchableOpacity
            onPress={onToggleAdd}
            disabled={!isEditable}
            className={`px-3 py-1.5 rounded border ${
              isEditable
                ? "bg-blue-50 border-blue-600"
                : "bg-gray-100 border-gray-300"
            }`}
          >
            <Text
              className={`text-sm ${
                isEditable ? "text-blue-700" : "text-gray-400"
              }`}
            >
              {addOpen ? "Cancel" : addButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isEditable && addOpen && (
        <View className="flex-row items-center bg-blue-50 border border-blue-300 rounded px-2 py-2 mt-1 relative z-20">
          <View style={{ flex: flexMap.item }} className="relative">
            <TouchableOpacity
              ref={variantTriggerRef}
              onPress={onToggleVariantPicker}
              className="border border-gray-300 rounded p-2 bg-white"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-800" numberOfLines={1}>
                  {formIsPending
                    ? `${pendingFormLabel} 🕒`
                    : variantLabelById(formVariant)}
                </Text>
                <ChevronDown size={16} color="#374151" />
              </View>
            </TouchableOpacity>
            {errors.variant ? (
              <Text className="text-red-600 text-xs mt-1">{errors.variant}</Text>
            ) : null}
          </View>

          <View style={{ flex: flexMap.quantity }} className="px-1">
            <TextInput
              value={formQuantity}
              onChangeText={onQuantityChange}
              keyboardType="numeric"
              className="border border-gray-300 rounded p-2 bg-white text-sm"
              placeholder={quantityPlaceholder}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              autoCorrect={false}
            />
            {errors.quantity ? (
              <Text className="text-red-600 text-xs mt-1">{errors.quantity}</Text>
            ) : null}
          </View>

          {additionalFields.map((field) => {
            const colFlex = field.column?.flex ?? 10;
            return (
              <View key={field.key} style={{ flex: colFlex }} className="px-1">
                <TextInput
                  value={additionalValues[field.key]}
                  onChangeText={(value) => onAdditionalChange(field.key, value)}
                  keyboardType={field.keyboard || "default"}
                  className="border border-gray-300 rounded p-2 bg-white text-sm"
                  placeholder={field.placeholder || field.label}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                  autoCorrect={false}
                />
                {errors[field.key] ? (
                  <Text className="text-red-600 text-xs mt-1">{errors[field.key]}</Text>
                ) : null}
              </View>
            );
          })}

          <View style={{ flex: flexMap.unit }} className="px-1 relative">
            <TouchableOpacity
              ref={unitTriggerRef}
              onPress={onToggleUnitPicker}
              className="border border-gray-300 rounded p-2 bg-white"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-800" numberOfLines={1}>
                  {formUnit ? unitsMap[formUnit] || "—" : "Unit"}
                </Text>
                <ChevronDown size={16} color="#374151" />
              </View>
            </TouchableOpacity>
            {errors.unit ? (
              <Text className="text-red-600 text-xs mt-1">{errors.unit}</Text>
            ) : null}
          </View>

          {showDimensions && (
            <>
              <View style={{ flex: flexMap.length }} className="px-1">
                <TextInput
                  value={formLength}
                  onChangeText={onLengthChange}
                  keyboardType="numeric"
                  className="border border-gray-300 rounded p-2 bg-white text-sm"
                  placeholder="Len"
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                  autoCorrect={false}
                />
              </View>
              <View style={{ flex: flexMap.width }} className="px-1">
                <TextInput
                  value={formWidth}
                  onChangeText={onWidthChange}
                  keyboardType="numeric"
                  className="border border-gray-300 rounded p-2 bg-white text-sm"
                  placeholder="Wid"
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                  autoCorrect={false}
                />
              </View>
            </>
          )}

          {showComment && (
            <View style={{ flex: flexMap.comment }} className="px-1">
              <TextInput
                value={formComment}
                onChangeText={onCommentChange}
                className="border border-gray-300 rounded p-2 bg-white text-sm"
                placeholder="Comment"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
                autoCorrect={false}
              />
            </View>
          )}

          <View style={{ flex: flexMap.actions, paddingRight: 12 }}>
            <View className="flex-row gap-2 flex-wrap items-center justify-start">
              <TouchableOpacity
                onPress={onCancelAdd}
                className="px-2 py-1 rounded bg-red-50 border border-red-600"
              >
                <Text className="text-red-800 text-xs">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSave}
                className="px-2 py-1 rounded bg-blue-50 border border-blue-600"
                disabled={isSaving}
              >
                <Text className="text-blue-700 text-xs">
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {cameraEnabled && (
            <View style={{ flex: flexMap.camera }} className="items-center justify-center">
              <Text className="text-xs text-gray-500">After save</Text>
            </View>
          )}
        </View>
      )}
    </>
  );
};

export default OrderPackageMaterialsSectionHeaderAndAddRow;
