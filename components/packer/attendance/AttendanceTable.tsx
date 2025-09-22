import React from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { AttendanceTableHeader } from "./AttendanceTableHeader";
import { AttendanceRow } from "./AttendanceRow";

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

interface AttendanceRecord {
  [name: string]: AttendanceEntry;
}

type TimePeriod = 'morning' | 'afternoon';

interface AttendanceTableProps {
  names: string[];
  attendance: AttendanceRecord;
  isAfternoon: boolean;
  isMorning: boolean;
  onPresenceToggle: (name: string, period: TimePeriod, isPresent: boolean) => void;
  onToggleTime: (name: string, period: TimePeriod, timeType: 'start' | 'end') => void;
  onLongPress: (name: string, period: TimePeriod, timeType: 'start' | 'end') => void;
  onMouseUp: () => void;
  onClearEndTime: (name: string, period: TimePeriod) => void;
  onBulkPresenceToggle: (period: TimePeriod, isPresent: boolean) => void;
  onBulkTimeToggle: (period: TimePeriod, timeType: 'start' | 'end') => void;
  onEndWork?: (name: string, period: TimePeriod) => void;
  onRecordNewAttendance?: (name: string, period: TimePeriod) => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  names,
  attendance,
  isAfternoon,
  isMorning,
  onPresenceToggle,
  onToggleTime,
  onLongPress,
  onMouseUp,
  onClearEndTime,
  onBulkPresenceToggle,
  onBulkTimeToggle,
  onEndWork,
  onRecordNewAttendance,
}) => {
  const { width } = useWindowDimensions();
  const minTableWidth = 800; // fits the column layout
  const tableWidth = Math.max(minTableWidth, Math.floor(width - 64));

  return (
    <View className="flex-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: width < 900 ? 12 : 16 }}
      >
        <View style={{ width: tableWidth }} className="rounded-md">
          <ScrollView showsVerticalScrollIndicator={false} className="rounded-md border-3 border-gray-300">
            <AttendanceTableHeader 
              isAfternoon={isAfternoon}
              isMorning={isMorning}
              onBulkPresenceToggle={onBulkPresenceToggle}
              onBulkTimeToggle={onBulkTimeToggle}
            />
            {names.map((name) => (
              <AttendanceRow
                key={name}
                name={name}
                attendance={attendance[name] || {
                  morning: {
                    present: null,
                    startTime: null,
                    endTime: null,
                    manualStart: false,
                    manualEnd: false
                  },
                  afternoon: {
                    present: null,
                    startTime: null,
                    endTime: null,
                    manualStart: false,
                    manualEnd: false
                  }
                }}
                isAfternoon={isAfternoon}
                isMorning={isMorning}
                onPresenceToggle={onPresenceToggle}
                onToggleTime={onToggleTime}
                onLongPress={onLongPress}
                onMouseUp={onMouseUp}
                onClearEndTime={onClearEndTime}
                onEndWork={onEndWork}
                onRecordNewAttendance={onRecordNewAttendance}
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};
