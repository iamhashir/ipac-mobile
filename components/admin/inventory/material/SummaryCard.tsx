import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Material, Supplier, Tag } from '../../../../utils/api/inventory';

type TabType = "materials" | "suppliers" | "tags" | "settings";

interface SummaryCardProps {
  activeTab: TabType;
  materials: Material[];
  suppliers: Supplier[];
  tags: Tag[];
  onAddMaterial: () => void;
  onAddSupplier: () => void;
}

export function SummaryCard({
  activeTab,
  materials,
  suppliers,
  tags,
  onAddMaterial,
  onAddSupplier,
}: SummaryCardProps) {
  const Card = ({
    title,
    count,
    color,
    onAdd,
  }: {
    title: string;
    count: number;
    color: "blue" | "green" | "purple" | "gray";
    onAdd?: () => void;
  }) => {
    const colors: any = {
      blue: {
        bg: "bg-blue-50",
        title: "text-blue-600",
        count: "text-blue-800",
        border: "border-blue-100",
        btn: "bg-blue-600",
      },
      green: {
        bg: "bg-green-50",
        title: "text-green-600",
        count: "text-green-800",
        border: "border-green-100",
        btn: "bg-green-600",
      },
      purple: {
        bg: "bg-purple-50",
        title: "text-purple-600",
        count: "text-purple-800",
        border: "border-purple-100",
        btn: "bg-purple-600",
      },
      gray: {
        bg: "bg-gray-50",
        title: "text-gray-600",
        count: "text-gray-800",
        border: "border-gray-200",
        btn: "bg-gray-600",
      },
    };
    const c = colors[color];
    return (
      <View
        className={`ml-2 ${c.bg} border ${c.border} rounded-lg px-3 py-2 h-10 justify-between`}
      >
        <View className="flex-row items-center justify-between gap-2">
          <Text className={`text-xs font-medium ${c.title}`}>{title}</Text>
          <Text className={`text-base font-bold ${c.count}`}>{count}</Text>
          {onAdd && (
            <TouchableOpacity
              onPress={onAdd}
              className={`${c.btn} px-2 py-1 rounded`}
            >
              <Text className="text-white text-xs font-medium">Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (activeTab === "materials")
    return (
      <Card
        title="Materials"
        count={materials.length}
        color="blue"
        onAdd={onAddMaterial}
      />
    );
  if (activeTab === "suppliers")
    return (
      <Card
        title="Suppliers"
        count={suppliers.length}
        color="green"
        onAdd={onAddSupplier}
      />
    );
  if (activeTab === "tags")
    return <Card title="Tags" count={tags.length} color="purple" />;
  return <Card title="Settings" count={0} color="gray" />;
}