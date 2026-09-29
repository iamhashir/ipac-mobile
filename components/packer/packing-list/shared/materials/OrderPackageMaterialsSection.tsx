import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import CollapsibleCard from "../../common/CollapsibleCard";
import OrderPackageMaterialsSectionHeaderAndAddRow from "./OrderPackageMaterialsSectionHeaderAndAddRow";
import OrderPackageMaterialsSectionAddOverlays from "./OrderPackageMaterialsSectionAddOverlays";
import { useOrderPackageMaterialsSection } from "./useOrderPackageMaterialsSection";
import {
  EMPTY_ADDITIONAL_FIELDS,
  MATERIALS_ROW_FLEX,
  formatNumeric,
  type OrderPackageMaterialsSectionProps,
} from "./OrderPackageMaterialsSection.types";
import {
  MaterialsDataRow,
  MaterialsHeaderRow,
  type MaterialsColumn,
} from "./OrderPackageMaterialsSectionRows";

export type {
  VariantSourceType,
  VariantSource,
  AdditionalFieldConfig,
  OrderPackageMaterialsSectionProps,
} from "./OrderPackageMaterialsSection.types";

const OrderPackageMaterialsSection: React.FC<
  OrderPackageMaterialsSectionProps
> = ({
  orderPackageId,
  title,
  materialType,
  variantSources = [],
  customVariantLoader,
  quantityLabel = "Qty",
  quantityPlaceholder = "e.g. 1",
  addButtonLabel = "Add item",
  mediaDesignation,
  addPendingConfig,
  restrictToAllowedVariants = true,
  showDimensions = true,
  showComment = true,
  showCameraColumn,
  hideUseButton = false,
  hideRemoveButton = false,
  additionalFields = EMPTY_ADDITIONAL_FIELDS,
  editable = true,
  hideInnerSectionTitle = false,
}) => {
  const isEditable = editable !== false;
  const cameraEnabled =
    mediaDesignation && (showCameraColumn ?? true) ? true : false;

  const {
    items,
    variants,
    unitsMap,
    addOpen,
    variantPickerOpen,
    setVariantPickerOpen,
    unitPickerOpen,
    setUnitPickerOpen,
    variantAnchor,
    unitAnchor,
    variantSearchQuery,
    setVariantSearchQuery,
    unitSearchQuery,
    setUnitSearchQuery,
    errors,
    setErrors,
    isSaving,
    showAddMaterialModal,
    setShowAddMaterialModal,
    commentPreview,
    variantTriggerRef,
    unitTriggerRef,
    formVariant,
    setFormVariant,
    formIsPending,
    setFormIsPending,
    pendingFormLabel,
    setPendingFormLabel,
    formQuantity,
    formUnit,
    setFormUnit,
    formLength,
    setFormLength,
    formWidth,
    setFormWidth,
    formComment,
    setFormComment,
    additionalValues,
    filteredVariantOptions,
    filteredUnitOptions,
    variantLabelById,
    variantLabelForRow,
    toggleVariantPicker,
    toggleUnitPicker,
    saveNew,
    markUsed,
    removeRow,
    handleCameraPress,
    openCommentModal,
    closeCommentModal,
    handleToggleAdd,
    handleCancelAdd,
    handleQuantityChange,
    handleAdditionalChange,
    handlePendingMaterialSuccess,
  } = useOrderPackageMaterialsSection({
    orderPackageId,
    title,
    materialType,
    variantSources,
    customVariantLoader,
    restrictToAllowedVariants,
    additionalFields,
    showDimensions,
    showComment,
    mediaDesignation,
    isEditable,
    cameraEnabled,
  });

  const additionalColumns: MaterialsColumn[] = additionalFields
    .filter((field) => field.column)
    .map((field) => ({
      key: field.key,
      label: field.column?.label || field.label,
      flex: field.column?.flex ?? 10,
      render: field.column?.render,
    }));

  const FLEX = MATERIALS_ROW_FLEX;

  const formatDimensionValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "—";
    return formatNumeric(value);
  };

  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard
        title={title}
        containerClassName="border-gray-500 bg-white"
        defaultOpen
      >
        <View className="w-full rounded p-3 bg-gray-50 border border-gray-200">
          <OrderPackageMaterialsSectionHeaderAndAddRow
            title={title}
            hideInnerSectionTitle={hideInnerSectionTitle}
            isEditable={isEditable}
            addOpen={addOpen}
            addButtonLabel={addButtonLabel}
            quantityPlaceholder={quantityPlaceholder}
            showDimensions={showDimensions}
            showComment={showComment}
            cameraEnabled={cameraEnabled}
            flexMap={FLEX}
            additionalFields={additionalFields}
            additionalValues={additionalValues}
            errors={errors}
            formVariant={formVariant}
            formIsPending={formIsPending}
            pendingFormLabel={pendingFormLabel}
            formQuantity={formQuantity}
            formUnit={formUnit}
            formLength={formLength}
            formWidth={formWidth}
            formComment={formComment}
            unitsMap={unitsMap}
            variantTriggerRef={variantTriggerRef}
            unitTriggerRef={unitTriggerRef}
            variantLabelById={variantLabelById}
            onToggleAdd={handleToggleAdd}
            onToggleVariantPicker={toggleVariantPicker}
            onToggleUnitPicker={toggleUnitPicker}
            onQuantityChange={handleQuantityChange}
            onAdditionalChange={handleAdditionalChange}
            onLengthChange={setFormLength}
            onWidthChange={setFormWidth}
            onCommentChange={setFormComment}
            onCancelAdd={handleCancelAdd}
            onSave={saveNew}
            isSaving={isSaving}
          />

          <MaterialsHeaderRow
            quantityLabel={quantityLabel}
            additionalColumns={additionalColumns}
            showDimensions={showDimensions}
            showComment={showComment}
            cameraEnabled={cameraEnabled}
            flexMap={FLEX}
          />

          {(items || []).length === 0 ? (
            <View className="mt-2 p-3 bg-white border border-gray-200 rounded">
              <Text className="text-sm text-gray-500">No rows added yet.</Text>
            </View>
          ) : (
            (items || []).map((row) => (
              <MaterialsDataRow
                key={row.id}
                row={row}
                additionalColumns={additionalColumns}
                showDimensions={showDimensions}
                showComment={showComment}
                cameraEnabled={cameraEnabled}
                flexMap={FLEX}
                unitsMap={unitsMap}
                variantLabelForRow={variantLabelForRow}
                formatDimensionValue={formatDimensionValue}
                openCommentModal={openCommentModal}
                hideUseButton={hideUseButton}
                hideRemoveButton={hideRemoveButton}
                isEditable={isEditable}
                markUsed={markUsed}
                removeRow={removeRow}
                handleCameraPress={handleCameraPress}
              />
            ))
          )}
        </View>
      </CollapsibleCard>

      <OrderPackageMaterialsSectionAddOverlays
        isEditable={isEditable}
        addOpen={addOpen}
        variants={variants}
        addPendingConfig={addPendingConfig}
        orderPackageId={orderPackageId}
        materialType={materialType}
        showAddMaterialModal={showAddMaterialModal}
        setShowAddMaterialModal={setShowAddMaterialModal}
        onPendingSuccess={handlePendingMaterialSuccess}
        variantPickerOpen={variantPickerOpen}
        setVariantPickerOpen={setVariantPickerOpen}
        variantAnchor={variantAnchor}
        variantSearchQuery={variantSearchQuery}
        setVariantSearchQuery={setVariantSearchQuery}
        filteredVariantOptions={filteredVariantOptions}
        unitPickerOpen={unitPickerOpen}
        setUnitPickerOpen={setUnitPickerOpen}
        unitAnchor={unitAnchor}
        unitSearchQuery={unitSearchQuery}
        setUnitSearchQuery={setUnitSearchQuery}
        filteredUnitOptions={filteredUnitOptions}
        setFormVariant={setFormVariant}
        setFormIsPending={setFormIsPending}
        setPendingFormLabel={setPendingFormLabel}
        setFormUnit={setFormUnit}
        setErrors={setErrors}
      />

      <Modal
        visible={commentPreview.visible}
        transparent
        animationType="fade"
        onRequestClose={closeCommentModal}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-black/40 justify-center items-center"
          onPress={closeCommentModal}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="w-11/12 bg-white rounded-lg p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-gray-800 mb-3">
              {commentPreview.title}
            </Text>
            <ScrollView className="max-h-60 mb-4">
              <Text className="text-sm text-gray-700 leading-5">
                {commentPreview.text}
              </Text>
            </ScrollView>
            <TouchableOpacity
              onPress={closeCommentModal}
              className="self-end px-4 py-2 rounded bg-blue-50 border border-blue-600"
            >
              <Text className="text-blue-700 font-medium">Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

export default OrderPackageMaterialsSection;
