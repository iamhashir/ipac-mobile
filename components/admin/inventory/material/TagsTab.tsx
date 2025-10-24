import React from 'react';
import { ScrollView } from 'react-native';
import { TagManagement } from '../../../inventory/InventoryComponents';
import { Material, Tag } from '../../../../utils/api/inventory';

interface TagsTabProps {
  filteredTags: Tag[];
  materials: Material[];
  onCreateTag: (name: string) => void;
  onDeleteTag: (tag: Tag) => void;
  onUpdateTag: (tag: Tag, newName: string) => void;
}

export function TagsTab({
  filteredTags,
  materials,
  onCreateTag,
  onDeleteTag,
  onUpdateTag,
}: TagsTabProps) {
  return (
    <ScrollView className="flex-1 px-6 py-4">
      <TagManagement
        tags={filteredTags}
        materials={materials}
        onCreateTag={onCreateTag}
        onDeleteTag={onDeleteTag}
        onUpdateTag={onUpdateTag}
      />
    </ScrollView>
  );
}