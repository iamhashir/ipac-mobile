import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Plus } from 'lucide-react-native';
import { DataTable, ColumnDef, SortDirection } from '../../../ui/DataTable';
import { SearchableMultiSelect, SelectOption } from '../../../ui/SearchableMultiSelect';
import { Material, MaterialVariant, SupplierPricing, Tag } from '../../../../utils/api/inventory';

interface MaterialsTableViewProps {
  materials: Material[];
  tags: Tag[];
  allTags: Tag[]; // All tags including variant tags
}

// Flattened row structure for the table
interface MaterialRow {
  id: string;
  materialId: string;
  materialName: string;
  variantId: string;
  variantName: string;
  variantDescription: string;
  supplierId: string;
  supplierName: string;
  supplierReference: string;
  lengthCm: number | null;
  widthCm: number | null;
  thicknessCm: number | null;
  unit: string;
  supplierQuantity: number | null;
  price: number | null;
  pricePerUnit: number | null;
  lastUpdated: string;
  tags: Tag[];
  variantTags: Tag[]; // Variant-specific tags
}

export function MaterialsTableView({ materials, tags, allTags }: MaterialsTableViewProps) {
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedVariantTags, setSelectedVariantTags] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // New entry form state
  const [showAddRow, setShowAddRow] = useState(false);
  const [newEntry, setNewEntry] = useState({
    materialId: '',
    variantName: '',
    variantDescription: '',
    supplierName: '',
    supplierReference: '',
    lengthCm: '',
    widthCm: '',
    thicknessCm: '',
    supplierQuantity: '',
    price: '',
  });

  // Prepare material options for filter
  const materialOptions: SelectOption[] = useMemo(() => {
    return materials.map((m) => ({
      value: m.id,
      label: m.name,
    }));
  }, [materials]);

  // Prepare variant tag options for filter
  const variantTagOptions: SelectOption[] = useMemo(() => {
    return allTags.map((t) => ({
      value: t.id,
      label: t.name,
    }));
  }, [allTags]);

  // Flatten materials data into table rows
  const tableData: MaterialRow[] = useMemo(() => {
    const rows: MaterialRow[] = [];

    materials.forEach((material) => {
      // Get material tags
      const materialTags =
        material.material_tags?.map((mt) => mt.tags).filter(Boolean) || [];

      // Skip materials without variants - we only show materials with pricing data
      if (!material.material_variants || material.material_variants.length === 0) {
        return;
      }

      material.material_variants.forEach((variant: any) => {
        // Get variant-specific tags
        const variantTags =
          variant.material_variant_tags?.map((vt: any) => vt.tags).filter(Boolean) || [];

        // Skip variants without pricing - we only show rows with complete data
        if (!variant.supplier_pricing || variant.supplier_pricing.length === 0) {
          return;
        }

        // Create a row for each supplier pricing
        variant.supplier_pricing.forEach((pricing: any) => {
          rows.push({
            id: `${material.id}-${variant.id}-${pricing.id}`,
            materialId: material.id,
            materialName: material.name,
            variantId: variant.id,
            variantName: variant.variant_name,
            variantDescription: variant.description || '-',
            supplierId: pricing.supplier_id,
            supplierName: pricing.suppliers?.name || '-',
            supplierReference: '-', // Add this field to your DB if needed
            lengthCm: variant.length,
            widthCm: variant.width,
            thicknessCm: variant.thickness,
            unit: variant.unit?.name || material.unit?.name || '-',
            supplierQuantity: pricing.supplier_quantity,
            price: pricing.price,
            pricePerUnit: pricing.price_per_unit,
            lastUpdated: pricing.updated_at
              ? new Date(pricing.updated_at).toLocaleDateString()
              : '-',
            tags: materialTags as Tag[],
            variantTags: variantTags as Tag[],
          });
        });
      });
    });

    return rows;
  }, [materials]);

  // Apply filters
  const filteredData = useMemo(() => {
    let filtered = tableData;

    // Filter by selected materials
    if (selectedMaterials.length > 0) {
      filtered = filtered.filter((row) =>
        selectedMaterials.includes(row.materialId)
      );
    }

    // Filter by selected variant tags
    if (selectedVariantTags.length > 0) {
      filtered = filtered.filter((row) =>
        row.variantTags.some((tag) => selectedVariantTags.includes(tag.id))
      );
    }

    return filtered;
  }, [tableData, selectedMaterials, selectedVariantTags]);

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aValue = (a as any)[sortColumn];
      const bValue = (b as any)[sortColumn];

      // Handle null values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Define table columns
  const columns: ColumnDef<MaterialRow>[] = [
    {
      key: 'supplierName',
      header: 'Supplier',
      accessor: (row) => row.supplierName,
      width: 150,
      sortable: true,
    },
    {
      key: 'variantName',
      header: 'Variant Name',
      accessor: (row) => row.variantName,
      width: 180,
      sortable: true,
    },
    {
      key: 'variantDescription',
      header: 'Variant Description',
      accessor: (row) => row.variantDescription,
      width: 200,
      sortable: true,
    },
    {
      key: 'supplierReference',
      header: 'Supplier Reference',
      accessor: (row) => row.supplierReference,
      width: 150,
      sortable: true,
    },
    {
      key: 'lengthCm',
      header: 'Length (cm)',
      accessor: (row) => row.lengthCm,
      width: 120,
      sortable: true,
      render: (value) => (
        <Text className="text-sm text-gray-900">
          {value != null ? value.toFixed(2) : '-'}
        </Text>
      ),
    },
    {
      key: 'widthCm',
      header: 'Width (cm)',
      accessor: (row) => row.widthCm,
      width: 120,
      sortable: true,
      render: (value) => (
        <Text className="text-sm text-gray-900">
          {value != null ? value.toFixed(2) : '-'}
        </Text>
      ),
    },
    {
      key: 'thicknessCm',
      header: 'Thickness (cm)',
      accessor: (row) => row.thicknessCm,
      width: 120,
      sortable: true,
      render: (value) => (
        <Text className="text-sm text-gray-900">
          {value != null ? value.toFixed(2) : '-'}
        </Text>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      accessor: (row) => row.unit,
      width: 100,
      sortable: true,
    },
    {
      key: 'supplierQuantity',
      header: 'Supplier Qty',
      accessor: (row) => row.supplierQuantity,
      width: 120,
      sortable: true,
      render: (value) => (
        <Text className="text-sm text-gray-900">
          {value != null ? value : '-'}
        </Text>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      accessor: (row) => row.price,
      width: 120,
      sortable: true,
      render: (value) => (
        <Text className="text-sm font-medium text-green-600">
          {value != null ? `AED ${value.toFixed(2)}` : '-'}
        </Text>
      ),
    },
    {
      key: 'pricePerUnit',
      header: 'Price/Unit',
      accessor: (row) => row.pricePerUnit,
      width: 120,
      sortable: true,
      render: (value) => (
        <Text className="text-sm text-gray-700">
          {value != null ? `AED ${value.toFixed(2)}` : '-'}
        </Text>
      ),
    },
    {
      key: 'lastUpdated',
      header: 'Last Updated',
      accessor: (row) => row.lastUpdated,
      width: 130,
      sortable: true,
    },
  ];

  return (
    <View className="flex-1 px-6 py-4">
      {/* Filters Section */}
      <View className="mb-4">
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Filter Materials
        </Text>
        <View className="flex-row space-x-4">
          <View className="flex-1">
            <SearchableMultiSelect
              label="Materials"
              options={materialOptions}
              selectedValues={selectedMaterials}
              onSelectionChange={setSelectedMaterials}
              placeholder="Select materials..."
            />
          </View>
          <View className="flex-1">
            <SearchableMultiSelect
              label="Variant Tags"
              options={variantTagOptions}
              selectedValues={selectedVariantTags}
              onSelectionChange={setSelectedVariantTags}
              placeholder="Select variant tags..."
            />
          </View>
        </View>
      </View>

      {/* Results Summary */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm text-gray-600">
          Showing {sortedData.length} of {tableData.length} entries
          {(selectedMaterials.length > 0 || selectedVariantTags.length > 0) && (
            <Text className="text-blue-600 font-medium"> (filtered)</Text>
          )}
        </Text>
        <TouchableOpacity
          onPress={() => setShowAddRow(!showAddRow)}
          className="bg-blue-600 px-4 py-2 rounded-lg flex-row items-center"
        >
          <Plus size={16} color="#ffffff" />
          <Text className="text-white font-medium ml-2">
            {showAddRow ? 'Hide' : 'Add Entry'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Table */}
      <View className="flex-1">
        <DataTable
          columns={columns}
          data={sortedData}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          emptyMessage="No materials found. Try adjusting your filters."
        />
        
        {/* Sticky Add Row */}
        {showAddRow && (
          <View className="bg-blue-50 border-t-2 border-blue-300">
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View className="flex-row p-3">
                {/* Material Selector */}
                <View style={{ width: 150 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">MATERIAL</Text>
                  <SearchableMultiSelect
                    options={materialOptions}
                    selectedValues={newEntry.materialId ? [newEntry.materialId] : []}
                    onSelectionChange={(vals) => setNewEntry({ ...newEntry, materialId: vals[0] || '' })}
                    placeholder="Select material..."
                  />
                </View>
                
                {/* Supplier Name */}
                <View style={{ width: 150 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">SUPPLIER</Text>
                  <TextInput
                    value={newEntry.supplierName}
                    onChangeText={(text) => setNewEntry({ ...newEntry, supplierName: text })}
                    placeholder="Supplier name"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Variant Name */}
                <View style={{ width: 180 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">VARIANT NAME</Text>
                  <TextInput
                    value={newEntry.variantName}
                    onChangeText={(text) => setNewEntry({ ...newEntry, variantName: text })}
                    placeholder="Variant name"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Variant Description */}
                <View style={{ width: 200 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">DESCRIPTION</Text>
                  <TextInput
                    value={newEntry.variantDescription}
                    onChangeText={(text) => setNewEntry({ ...newEntry, variantDescription: text })}
                    placeholder="Description"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Supplier Reference */}
                <View style={{ width: 150 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">REFERENCE</Text>
                  <TextInput
                    value={newEntry.supplierReference}
                    onChangeText={(text) => setNewEntry({ ...newEntry, supplierReference: text })}
                    placeholder="Reference"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Length */}
                <View style={{ width: 120 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">LENGTH (CM)</Text>
                  <TextInput
                    value={newEntry.lengthCm}
                    onChangeText={(text) => setNewEntry({ ...newEntry, lengthCm: text })}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Width */}
                <View style={{ width: 120 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">WIDTH (CM)</Text>
                  <TextInput
                    value={newEntry.widthCm}
                    onChangeText={(text) => setNewEntry({ ...newEntry, widthCm: text })}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Thickness */}
                <View style={{ width: 120 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">THICKNESS (CM)</Text>
                  <TextInput
                    value={newEntry.thicknessCm}
                    onChangeText={(text) => setNewEntry({ ...newEntry, thicknessCm: text })}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Supplier Quantity */}
                <View style={{ width: 120 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">SUPPLIER QTY</Text>
                  <TextInput
                    value={newEntry.supplierQuantity}
                    onChangeText={(text) => setNewEntry({ ...newEntry, supplierQuantity: text })}
                    placeholder="0"
                    keyboardType="numeric"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Price */}
                <View style={{ width: 120 }} className="mr-2">
                  <Text className="text-xs font-semibold text-gray-700 mb-1">PRICE</Text>
                  <TextInput
                    value={newEntry.price}
                    onChangeText={(text) => setNewEntry({ ...newEntry, price: text })}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    className="bg-white border border-gray-300 rounded px-2 py-2 text-sm"
                  />
                </View>
                
                {/* Action Button */}
                <View style={{ width: 100 }} className="justify-end">
                  <TouchableOpacity
                    onPress={() => {
                      // TODO: Implement save logic
                      console.log('Save new entry:', newEntry);
                    }}
                    className="bg-green-600 px-4 py-2 rounded-lg"
                  >
                    <Text className="text-white font-medium text-center">Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}
