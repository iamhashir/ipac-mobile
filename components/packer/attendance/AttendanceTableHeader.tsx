import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { CheckCircle, XCircle, Clock } from "lucide-react-native";

type TimePeriod = "morning" | "afternoon";

interface AttendanceTableHeaderProps {
  isAfternoon: boolean;
  isMorning: boolean;
  onBulkPresenceToggle: (period: TimePeriod, isPresent: boolean) => void;
  onBulkTimeToggle: (period: TimePeriod, timeType: "start" | "end") => void;
}

export const AttendanceTableHeader: React.FC<AttendanceTableHeaderProps> = ({
  isAfternoon,
  isMorning,
  onBulkPresenceToggle,
  onBulkTimeToggle,
}) => {
  return (
    <View
      className="bg-white border-b border-t border-x-2 border-gray-200"
      style={{ minWidth: 800 }}
    >
      {/* First Header Row */}
      <View className="flex-row justify-between bg-blue-100 border-b border-gray-300">
        <View className="w-[14.3%] p-3 border-r border-gray-300">
          <Text className="text-left font-medium text-gray-800">Name</Text>
        </View>
        <View className="w-[85.7%] flex-row">
          <View className="w-1/2 p-3 border-r border-gray-300 flex-row items-center justify-center">
            <Text className="font-medium text-gray-800">Morning</Text>
            {isAfternoon && (
              <Text className="text-red-500 ml-1 text-xs">
                (Disabled after 12:00)
              </Text>
            )}
          </View>
          <View className="w-1/2 p-3 flex-row items-center justify-center">
            <Text className="font-medium text-gray-800">Afternoon</Text>
          </View>
        </View>
      </View>

      {/* Second Header Row */}
      <View
        className="flex-row bg-blue-50 border-b border-gray-300"
        style={{ minWidth: 800 }}
      >
        <View className="w-[14.3%] p-2 border-r border-gray-300">
          {/* Empty cell for name column */}
        </View>

        {/* Morning columns */}
        <View className="w-[85.7%] flex-row">
          <View
            className="flex-1 p-2 border-r border-gray-300"
            style={{ minWidth: 200 }}
          >
            <View className="flex-col items-center">
              <Text className="text-xs mb-1 text-center">Present / Absent</Text>
              <View className="flex-row items-center gap-1 justify-center">
                <TouchableOpacity
                  className={`rounded-full p-1 ${
                    isAfternoon ? "opacity-50" : "bg-green-50"
                  }`}
                  onPress={() => onBulkPresenceToggle("morning", true)}
                  disabled={isAfternoon}
                >
                  <CheckCircle
                    size={24}
                    color={isAfternoon ? "#9CA3AF" : "#16A34A"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  className={`bg-red-50 rounded-full p-1 ${
                    isAfternoon ? "opacity-50" : ""
                  }`}
                  onPress={() => onBulkPresenceToggle("morning", false)}
                  disabled={isAfternoon}
                >
                  <XCircle size={24} color={isAfternoon ? "#9CA3AF" : "#DC2626"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View className="flex-1 items-center justify-center p-2 border-r border-gray-300">
            <View className={`bg-blue-50 rounded-full p-1 flex-row ${
              isAfternoon ? "opacity-50" : ""
            }`}>
              <Clock size={16} color={isAfternoon ? "#9CA3AF" : "#2563EB"} />
              <Text
                className={`ml-1 text-xs${
                  isAfternoon ? "text-gray-400" : "text-blue-600"
                }`}
              >
                Start (Auto)
              </Text>
            </View>
          </View>

          <View className="flex-1 items-center justify-center p-2 border-r border-gray-300">
            <TouchableOpacity
              className={`bg-blue-50 rounded-full p-1 flex-row ${
                isAfternoon ? "opacity-50" : ""
              }`}
              onPress={() => onBulkTimeToggle("morning", "end")}
              disabled={isAfternoon}
            >
              <Clock size={16} color={isAfternoon ? "#9CA3AF" : "#1E40AF"} />
              <Text
                className={`ml-1 text-xs ${
                  isAfternoon ? "text-gray-400" : "text-blue-800"
                }`}
              >
                End
              </Text>
            </TouchableOpacity>
          </View>

          {/* Afternoon columns */}
          <View
            className="flex-1 p-2 border-r border-gray-300"
            style={{ minWidth: 200 }}
          >
            <View className="flex-col items-center">
              <Text className="text-xs mb-1 text-center">Present / Absent</Text>
              <View className="flex-row items-center gap-1 justify-center">
                <TouchableOpacity
                  className={`bg-green-50 rounded-full p-1 ${
                    isMorning ? "opacity-50" : ""
                  }`}
                  onPress={() => onBulkPresenceToggle("afternoon", true)}
                  disabled={isMorning}
                >
                  <CheckCircle size={24} color={isMorning ? "#9CA3AF" : "#16A34A"} />
                </TouchableOpacity>
                <TouchableOpacity
                  className={`bg-red-50 rounded-full p-1 ${
                    isMorning ? "opacity-50" : "
                  }`}
                  onPress={() => onBulkPresenceToggle("afternoon", false)}
                  disabled={isMorning}
                >
                  <XCircle size={24} color={isMorning ? "#9CA3AF" : "#DC2626"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View className="flex-1 items-center justify-center p-2 border-r border-gray-300">
            <View className={`bg-blue-50 rounded-full p-1 flex-row ${
              isMorning ? "opacity-50" : ""
            }`}>
              <Clock size={16} color={isMorning ? "#9CA3AF" : "#2563EB"} />
              <Text className={`ml-1 text-xs ${
                isMorning ? "text-gray-400" : "text-blue-600"
              }`}>Start (Auto)</Text>
            </View>
          </View>

          <View className="flex-1 items-center justify-center p-2">
            <TouchableOpacity
              className={`bg-blue-50 rounded-full p-1 flex-row ${
                isMorning ? "opacity-50" : "
              }`}
              onPress={() => onBulkTimeToggle("afternoon", "end")}
              disabled={isMorning}
            >
              <Clock size={16} color={isMorning ? "#9CA3AF" : "#1E40AF"} />
              <Text className={`ml-1 text-xs ${
                isMorning ? "text-gray-400" : "text-blue-800"
              }`}>End</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};
