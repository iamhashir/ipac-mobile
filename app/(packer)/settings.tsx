import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavigationButtons } from "../../components/NavigationButtons";
import { useTextSize, TextSizeOption } from "../../utils/TextSizeContext";
import { currentVersion } from "../../utils/versioning";

export default function PackerSettings() {
  const { size, setSize } = useTextSize();
  const [saved, setSaved] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const save = (newSize: TextSizeOption) => {
    setSize(newSize);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const sizeLabel = (s: TextSizeOption) => {
    switch (s) {
      case "small":
        return "Small";
      case "medium":
        return "Medium";
      case "large":
        return "Large";
      case "xl":
        return "XL";
      case "xxl":
        return "XXL";
    }
  };

  const previewTextCls =
    size === "small"
      ? "text-sm"
      : size === "large"
      ? "text-lg"
      : size === "xl"
      ? "text-xl"
      : size === "xxl"
      ? "text-2xl"
      : "text-base";

  const formatReleaseDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
    //   edges={["top", "bottom", "left", "right"]}
    >
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-primary-500 px-4 py-3">
          <Text className="text-white text-xl font-bold">Settings</Text>
          <Text className="text-primary-100 text-xs mt-1">
            Personalize your workspace
          </Text>
        </View>

        {/* Navigation Buttons */}
        <NavigationButtons currentScreen="settings" />

        {/* Content */}
        <View className="flex-1 p-4">
          <View className="bg-white border border-gray-200 rounded-lg p-4">
            <Text className="text-gray-800 text-base font-semibold">
              Text size
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              Choose how large text should appear in the app
            </Text>

            <View className="flex-row flex-wrap mt-4 gap-2">
              {(
                ["small", "medium", "large", "xl", "xxl"] as TextSizeOption[]
              ).map((opt) => {
                const active = size === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Set text size to ${sizeLabel(opt)}`}
                    onPress={() => save(opt)}
                    className={`px-4 py-2 rounded-lg border ${
                      active
                        ? "bg-primary-50 border-primary-500"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <Text
                      className={`${
                        active ? "text-primary-700" : "text-gray-800"
                      } font-medium`}
                    >
                      {sizeLabel(opt)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {saved && (
              <Text className="text-green-600 text-xs mt-2">Saved</Text>
            )}

            <View className="mt-6">
              <Text className="text-gray-600 text-xs mb-2">Preview</Text>
              <View className="border border-gray-200 rounded-lg p-3">
                <Text className={`text-gray-800 ${previewTextCls}`}>
                  The quick brown fox jumps over the lazy dog.
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
            <Text className="text-gray-800 text-base font-semibold">
              Version
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              Stay aligned on the current build installed on this tablet.
            </Text>

            <View className="mt-4 flex-row items-baseline gap-2">
              <Text className="text-2xl font-bold text-gray-900">
                {currentVersion.versionCode}
              </Text>
              <View className="px-2 py-1 bg-primary-50 border border-primary-200 rounded-full">
                <Text className="text-primary-700 text-xs font-semibold">
                  {currentVersion.tag}
                </Text>
              </View>
            </View>

            <Text className="text-gray-600 text-sm mt-1">
              Released {formatReleaseDate(currentVersion.releaseDate)}
            </Text>

            {currentVersion.highlights?.length ? (
              <View className="mt-3">
                {currentVersion.highlights.map((highlight, index) => (
                  <View
                    key={`${currentVersion.versionCode}-highlight-${index}`}
                    className="flex-row items-start mb-2"
                  >
                    <Text className="text-primary-500 mr-2">•</Text>
                    <Text className="flex-1 text-gray-700 text-sm">
                      {highlight}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
