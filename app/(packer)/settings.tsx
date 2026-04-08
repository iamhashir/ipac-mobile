import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavigationButtons } from "../../components/NavigationButtons";
import { useTextSize, TextSizeOption } from "../../utils/TextSizeContext";
import { currentVersion } from "../../utils/versioning";
import { usePackerSession } from "../../utils/PackerSessionContext";

export default function PackerSettings() {
  const { size, setSize } = useTextSize();
  const {
    isRetrospectiveMode,
    retrospectiveDate,
    setRetrospectiveMode,
    setRetrospectiveDate,
  } = usePackerSession();
  const [saved, setSaved] = useState(false);
  const [retroDateInput, setRetroDateInput] = useState("");
  const [retroTimeInput, setRetroTimeInput] = useState("08:00");

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

  const pad2 = (value: number) => String(value).padStart(2, "0");

  const formatDateForInput = (date: Date) => {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate()
    )}`;
  };

  const formatTimeForInput = (date: Date) => {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  };

  const handleRetroToggle = (enabled: boolean) => {
    setRetrospectiveMode(enabled);

    if (enabled) {
      const base = retrospectiveDate ?? new Date();
      setRetroDateInput(formatDateForInput(base));
      setRetroTimeInput(formatTimeForInput(base));
      return;
    }

    setRetrospectiveDate(null);
  };

  const applyRetrospectiveDateTime = () => {
    const dateText = retroDateInput.trim();
    const timeText = retroTimeInput.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD format.");
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(timeText)) {
      Alert.alert("Invalid time", "Use HH:mm format.");
      return;
    }

    const [hourText, minuteText] = timeText.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      Alert.alert("Invalid time", "Hour must be 00-23 and minute 00-59.");
      return;
    }

    const parsed = new Date(`${dateText}T${timeText}:00`);

    if (Number.isNaN(parsed.getTime())) {
      Alert.alert("Invalid date/time", "Please enter a valid date and time.");
      return;
    }

    setRetrospectiveDate(parsed);
    setRetrospectiveMode(true);
    Alert.alert("Retrospective mode updated", `Base set to ${parsed.toLocaleString()}`);
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
              <View className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header row */}
                <View className="bg-sky-50 border-b border-gray-200 px-3 py-2">
                  <Text className={`text-sky-900 font-bold ${previewTextCls}`}>Package 1 — Cabinet A</Text>
                </View>
                {/* Detail row */}
                <View className="flex-row px-3 py-2 border-b border-gray-100">
                  <Text className={`text-gray-500 w-28 ${previewTextCls}`}>Net weight</Text>
                  <Text className={`text-gray-900 font-semibold ${previewTextCls}`}>12.5 kg</Text>
                </View>
                <View className="flex-row px-3 py-2">
                  <Text className={`text-gray-500 w-28 ${previewTextCls}`}>Dimensions</Text>
                  <Text className={`text-gray-900 font-semibold ${previewTextCls}`}>120 × 80 × 60 cm</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
            <Text className="text-gray-800 text-base font-semibold">
              Retrospective mode (temporary)
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              Use this only when recording work done earlier. Available to all users.
            </Text>

            <View className="mt-4 flex-row items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-3">
              <View className="flex-1 pr-3">
                <Text className="text-blue-900 font-semibold">Enable retrospective mode</Text>
                <Text className="text-blue-700 text-xs mt-1">
                  When ON, attendance and tasks use the selected backdated date/time.
                </Text>
              </View>
              <Switch value={isRetrospectiveMode} onValueChange={handleRetroToggle} />
            </View>

            <View className="mt-3">
              <Text className="text-gray-700 text-xs mb-1">Base date (YYYY-MM-DD)</Text>
              <TextInput
                value={retroDateInput}
                onChangeText={setRetroDateInput}
                placeholder="2026-03-24"
                editable={isRetrospectiveMode}
                className={`border rounded-lg px-3 py-3 text-base ${
                  isRetrospectiveMode
                    ? "bg-white border-gray-300 text-gray-900"
                    : "bg-gray-100 border-gray-200 text-gray-400"
                }`}
              />
            </View>

            <View className="mt-3">
              <Text className="text-gray-700 text-xs mb-1">Base time (HH:mm)</Text>
              <TextInput
                value={retroTimeInput}
                onChangeText={setRetroTimeInput}
                placeholder="08:00"
                editable={isRetrospectiveMode}
                className={`border rounded-lg px-3 py-3 text-base ${
                  isRetrospectiveMode
                    ? "bg-white border-gray-300 text-gray-900"
                    : "bg-gray-100 border-gray-200 text-gray-400"
                }`}
              />
            </View>

            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={applyRetrospectiveDateTime}
                disabled={!isRetrospectiveMode}
                className={`flex-1 rounded-lg py-3 items-center ${
                  isRetrospectiveMode ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <Text className="text-white font-semibold">Apply base date/time</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setRetrospectiveMode(false);
                  setRetrospectiveDate(null);
                  setRetroDateInput("");
                  setRetroTimeInput("08:00");
                }}
                className="flex-1 rounded-lg py-3 items-center bg-white border border-gray-300"
              >
                <Text className="text-gray-800 font-semibold">Reset</Text>
              </TouchableOpacity>
            </View>

            <View className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <Text className="text-green-800 text-xs">
                Current status: {isRetrospectiveMode ? "ON" : "OFF"}
              </Text>
              <Text className="text-green-800 text-xs mt-1">
                Base: {retrospectiveDate ? retrospectiveDate.toLocaleString() : "Not set"}
              </Text>
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
