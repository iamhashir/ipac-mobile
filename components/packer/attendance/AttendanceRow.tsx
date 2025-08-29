import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { CheckCircle, XCircle } from "lucide-react-native";

// Types
interface AttendancePeriod {
  present: boolean | null;
  startTime: string | null;
  endTime: string | null;
  manualStart: boolean;
  manualEnd: boolean;
}

interface AttendanceEntry {
  morning: AttendancePeriod;
  afternoon: AttendancePeriod;
}

type TimePeriod = "morning" | "afternoon";

interface AttendanceRowProps {
  name: string;
  attendance: AttendanceEntry;
  isAfternoon: boolean;
  isMorning: boolean;
  onPresenceToggle: (
    name: string,
    period: TimePeriod,
    isPresent: boolean
  ) => void;
  onToggleTime: (
    name: string,
    period: TimePeriod,
    timeType: "start" | "end"
  ) => void;
  onLongPress: (
    name: string,
    period: TimePeriod,
    timeType: "start" | "end"
  ) => void;
  onMouseUp: () => void;
  onClearEndTime: (name: string, period: TimePeriod) => void;
  onEndWork?: (name: string, period: TimePeriod) => void;
  onRecordNewAttendance?: (name: string, period: TimePeriod) => void;
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({
  name,
  attendance,
  isAfternoon,
  isMorning,
  onPresenceToggle,
  onToggleTime,
  onLongPress,
  onMouseUp,
  onClearEndTime,
  onEndWork,
  onRecordNewAttendance,
}) => {
  return (
    <View
      className="flex-row border-b border-x-2 border-gray-200"
    >
      {/* Name column */}
      <View className="w-[14.3%] p-3 border-r border-gray-300 justify-center">
        <Text className="font-medium text-gray-900">{name}</Text>
      </View>

      {/* Morning Presence */}
      <View className="w-[85.7%] flex-row">
        <View className="w-1/2 flex-row">
          <View
            className="flex-1 p-2 border-r border-gray-300"
            style={{ minWidth: 200 }}
          >
            <View className="flex-col items-center">
              <View className="flex-row justify-center gap-2">
                <TouchableOpacity
                  className={`px-3 py-2 rounded border-2 flex-row items-center ${
                    attendance.morning.present === true
                      ? "bg-blue-500 border-blue-500"
                      : "border-blue-300 bg-white"
                  } ${isAfternoon ? "opacity-50" : ""}`}
                  onPress={() => onPresenceToggle(name, "morning", true)}
                  disabled={isAfternoon}
                >
                  <CheckCircle
                    size={16}
                    color={
                      attendance.morning.present === true ? "white" : "#3B82F6"
                    }
                  />
                  <Text
                    className={`ml-1 text-xs ${
                      attendance.morning.present === true
                        ? "text-white"
                        : "text-blue-600"
                    }`}
                  >
                    Present
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`px-3 py-2 rounded border-2 flex-row items-center ${
                    attendance.morning.present === false
                      ? "bg-red-600 border-red-600"
                      : "border-red-300 bg-white"
                  } ${isAfternoon ? "opacity-50" : ""}`}
                  onPress={() => onPresenceToggle(name, "morning", false)}
                  disabled={isAfternoon}
                >
                  <XCircle
                    size={16}
                    color={
                      attendance.morning.present === false 
                        ? "white" 
                        : isAfternoon 
                          ? "#9CA3AF" 
                          : "#DC2626"
                    }
                  />
                  <Text
                    className={`ml-1 text-xs ${
                      attendance.morning.present === false
                        ? "text-white"
                        : isAfternoon
                          ? "text-gray-400"
                          : "text-red-600"
                    }`}
                  >
                    Absent
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Morning Start Time */}
          <View className="flex-1 p-2 border-r border-gray-300">
            <View
              className={`p-2 rounded flex items-center justify-center ${
                !attendance.morning.present || isAfternoon
                  ? "bg-gray-100"
                  : attendance.morning.startTime
                  ? "bg-green-700"
                  : "bg-blue-100"
              }`}
            >
              {attendance.morning.startTime ? (
                <Text className="text-lg font-bold text-white">
                  {attendance.morning.startTime}
                </Text>
              ) : (
                <Text
                  className={`${
                    !attendance.morning.present || isAfternoon
                      ? "text-gray-500"
                      : "text-blue-600"
                  }`}
                >
                  Start (Auto)
                </Text>
              )}
            </View>
          </View>

          {/* Morning End Time */}
          <View className="flex-1 p-2 border-r border-gray-300">
            <View className="flex-row gap-1">
              <TouchableOpacity
                className={`flex-grow p-2 rounded flex items-center justify-center ${
                  !attendance.morning.present ||
                  !attendance.morning.startTime ||
                  isAfternoon
                    ? "bg-gray-100"
                    : attendance.morning.endTime
                    ? "bg-green-700"
                    : "bg-blue-100"
                }`}
                disabled={
                  !attendance.morning.present ||
                  !attendance.morning.startTime ||
                  isAfternoon
                }
onPress={() => {
                  if (onEndWork && !attendance.morning.endTime) {
                    onEndWork(name, "morning");
                  }
                }}
                onLongPress={() => onLongPress(name, "morning", "end")}
              >
                {attendance.morning.endTime ? (
                  <Text className="text-lg font-bold text-white">
                    {attendance.morning.endTime}
                  </Text>
                ) : (
                  <Text
                    className={`${
                      !attendance.morning.present ||
                      !attendance.morning.startTime ||
                      isAfternoon
                        ? "text-gray-500"
                        : "text-blue-600"
                    }`}
                  >
                    End
                  </Text>
                )}
              </TouchableOpacity>

              {attendance.morning.endTime && !isAfternoon && (
                <TouchableOpacity
                  className="p-2 bg-red-100 rounded"
onPress={() => {
                    if (onRecordNewAttendance) {
                      onRecordNewAttendance(name, "morning");
                    }
                  }}
                >
                  <XCircle size={16} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Afternoon Presence */}
        <View className="w-1/2 flex-row">
          <View
            className="flex-1 p-2 border-r border-gray-300"
            style={{ minWidth: 200 }}
          >
            <View className="flex-col items-center">
              <View className="flex-row justify-center gap-2">
                <TouchableOpacity
                  className={`px-3 py-2 rounded border-2 flex-row items-center ${
                    attendance.afternoon.present === true
                      ? "bg-blue-500 border-blue-500"
                      : "border-blue-300 bg-white"
                  } ${isMorning ? "opacity-50" : ""}`}
                  onPress={() => onPresenceToggle(name, "afternoon", true)}
                  disabled={isMorning}
                >
                  <CheckCircle
                    size={16}
                    color={
                      attendance.afternoon.present === true
                        ? "white"
                        : isMorning
                          ? "#9CA3AF"
                          : "#3B82F6"
                    }
                  />
                  <Text
                    className={`ml-1 text-xs ${
                      attendance.afternoon.present === true
                        ? "text-white"
                        : isMorning
                          ? "text-gray-400"
                          : "text-blue-600"
                    }`}
                  >
                    Present
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`px-3 py-2 rounded border-2 flex-row items-center ${
                    attendance.afternoon.present === false
                      ? "bg-red-600 border-red-600"
                      : "border-red-300 bg-white"
                  } ${isMorning ? "opacity-50" : ""}`}
                  onPress={() => onPresenceToggle(name, "afternoon", false)}
                  disabled={isMorning}
                >
                  <XCircle
                    size={16}
                    color={
                      attendance.afternoon.present === false
                        ? "white"
                        : isMorning
                          ? "#9CA3AF"
                          : "#DC2626"
                    }
                  />
                  <Text
                    className={`ml-1 text-xs ${
                      attendance.afternoon.present === false
                        ? "text-white"
                        : isMorning
                          ? "text-gray-400"
                          : "text-red-600"
                    }`}
                  >
                    Absent
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Afternoon Start Time */}
          <View className="flex-1 p-2 border-r border-gray-300">
            <View
              className={`w-full p-2 rounded flex items-center justify-center ${
                !attendance.afternoon.present || isMorning
                  ? "bg-gray-100"
                  : attendance.afternoon.startTime
                  ? "bg-green-700"
                  : "bg-blue-100"
              }`}
            >
              {attendance.afternoon.startTime ? (
                <Text className="text-lg font-bold text-white">
                  {attendance.afternoon.startTime}
                </Text>
              ) : (
                <Text
                  className={`${
                    !attendance.afternoon.present || isMorning
                      ? "text-gray-500"
                      : "text-blue-600"
                  }`}
                >
                  Start (Auto)
                </Text>
              )}
            </View>
          </View>

          {/* Afternoon End Time */}
          <View className="flex-1 p-2">
            <View className="flex-row gap-1">
              <TouchableOpacity
                className={`flex-grow p-2 rounded flex items-center justify-center ${
                  !attendance.afternoon.present ||
                  !attendance.afternoon.startTime ||
                  isMorning
                    ? "bg-gray-100"
                    : attendance.afternoon.endTime
                    ? "bg-green-700"
                    : "bg-blue-100"
                }`}
                disabled={
                  !attendance.afternoon.present ||
                  !attendance.afternoon.startTime ||
                  isMorning
                }
onPress={() => {
                  if (onEndWork && !attendance.afternoon.endTime) {
                    onEndWork(name, "afternoon");
                  }
                }}
                onLongPress={() => onLongPress(name, "afternoon", "end")}
              >
                {attendance.afternoon.endTime ? (
                  <Text className="text-lg font-bold text-white">
                    {attendance.afternoon.endTime}
                  </Text>
                ) : (
                  <Text
                    className={`${
                      !attendance.afternoon.present ||
                      !attendance.afternoon.startTime ||
                      isMorning
                        ? "text-gray-500"
                        : "text-blue-600"
                    }`}
                  >
                    End
                  </Text>
                )}
              </TouchableOpacity>

              {attendance.afternoon.endTime && !isMorning && (
                <TouchableOpacity
                  className="p-2 bg-red-100 rounded border-b-2 border-gray-200"
onPress={() => {
                    if (onRecordNewAttendance) {
                      onRecordNewAttendance(name, "afternoon");
                    }
                  }}
                >
                  <XCircle size={16} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};
