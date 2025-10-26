import React from 'react';
import { Material, Supplier, UnitOfMeasure, Tag } from '../../../../utils/api/inventory';
import { MaterialsTableView } from './MaterialsTableView';

interface MaterialsTabProps {
  filteredMaterials: Material[];
  suppliers: Supplier[];
  units: UnitOfMeasure[];
  tags: Tag[];
  selectedTagFilter: string;
  searchQuery: string;
  loading: boolean;
  onEditMaterial: (material: Material) => void;
  onDeleteMaterial: (material: Material) => void;
  onManageVariants: (material: Material) => void;
  onClearFilters: () => void;
}

export function MaterialsTab({
  filteredMaterials,
  suppliers,
  units,
  tags,
  selectedTagFilter,
  searchQuery,
  loading,
  onEditMaterial,
  onDeleteMaterial,
  onManageVariants,
  onClearFilters,
}: MaterialsTabProps) {
  if (loading) {
    return null;
  }

  return (
    <MaterialsTableView
      materials={filteredMaterials}
      tags={tags}
      allTags={tags}
    />
  );
}
