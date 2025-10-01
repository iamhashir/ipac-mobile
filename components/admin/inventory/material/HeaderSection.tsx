import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Search, Tag as TagIcon, RefreshCw } from 'lucide-react-native';
import { TopTabs } from '../../../inventory/TopTabs';
import { Material, Supplier, Tag } from '../../../../utils/api/inventory';

type TabType = "materials" | "suppliers" | "tags" | "settings";

interface HeaderSectionProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTagFilter: string;
  setSelectedTagFilter: (tagId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  materials: Material[];
  suppliers: Supplier[];
  tags: Tag[];
  renderTopSummaryCard: () => React.ReactNode;
}

export function HeaderSection({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  selectedTagFilter,
  setSelectedTagFilter,
  refreshing,
  onRefresh,
  materials,
  suppliers,
  tags,
  renderTopSummaryCard,
}: HeaderSectionProps) {
  const tabs = [
    {
      key: "materials" as TabType,
      label: "Materials",
      icon: require('lucide-react-native').Package,
      count: materials.length,
    },
    {
      key: "suppliers" as TabType,
      label: "Suppliers",
      icon: require('lucide-react-native').Building2,
      count: suppliers.length,
    },
    {
      key: "tags" as TabType,
      label: "Tags",
      icon: TagIcon,
      count: tags.length,
    },
    { key: "settings" as TabType, label: "Settings", icon: require('lucide-react-native').Settings },
  ];

  return (
    <View className="px-6 py-4 bg-white border-b border-gray-200">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-gray-900">
          Inventory Management
        </Text>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={refreshing}
          className={`px-4 py-2 rounded-lg flex-row items-center ${
            refreshing ? "bg-gray-300" : "bg-blue-500"
          }`}
        >
          <Text className="text-white font-medium">
            {refreshing ? "Refreshing..." : "Refresh"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Top Tabs with compact right card inside container */}
      <TopTabs
        tabs={tabs.map((t) => ({
          key: t.key,
          label: t.label,
          count: t.count,
        }))}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabType)}
        rightSlot={renderTopSummaryCard()}
      />

      {/* Search Bar */}
      <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 mb-4">
        <Search size={20} color="#6b7280" />
        <TextInput
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="flex-1 ml-3 text-gray-900"
        />
      </View>

      {/* Tag Filter - Only show on materials tab */}
      {activeTab === "materials" && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Filter by Tag
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-2"
          >
            <View className="flex-row px-2">
              <TouchableOpacity
                onPress={() => setSelectedTagFilter("all")}
                className={`mr-3 px-3 py-2 rounded-lg ${
                  selectedTagFilter === "all"
                    ? "bg-purple-500"
                    : "bg-gray-200"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    selectedTagFilter === "all"
                      ? "text-white"
                      : "text-gray-700"
                  }`}
                >
                  All Materials ({materials.length})
                </Text>
              </TouchableOpacity>
              {tags.map((tag) => {
                const materialCount = materials.filter(
                  (m) =>
                    m.material_tags &&
                    m.material_tags.some((mt) => mt.tag_id === tag.id)
                ).length;
                return (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => setSelectedTagFilter(tag.id)}
                    className={`mr-3 px-3 py-2 rounded-lg flex-row items-center ${
                      selectedTagFilter === tag.id
                        ? "bg-purple-500"
                        : "bg-gray-200"
                    }`}
                  >
                    <TagIcon
                      size={14}
                      color={
                        selectedTagFilter === tag.id ? "#ffffff" : "#6b7280"
                      }
                    />
                    <Text
                      className={`ml-1 text-sm font-medium ${
                        selectedTagFilter === tag.id
                          ? "text-white"
                          : "text-gray-700"
                      }`}
                    >
                      {tag.name} ({materialCount})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}