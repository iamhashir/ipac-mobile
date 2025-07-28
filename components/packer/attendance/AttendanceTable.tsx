import React from "react";
import { View, ScrollView } from "react-native";
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
  onPresenceToggle: (name: string, period: TimePeriod, isPresent: boolean) => void;
  onToggleTime: (name: string, period: TimePeriod, timeType: 'start' | 'end') => void;
  onLongPress: (name: string, period: TimePeriod, timeType: 'start' | 'end') => void;
  onMouseUp: () => void;
  onClearEndTime: (name: string, period: TimePeriod) => void;
  onBulkPresenceToggle: (period: TimePeriod, isPresent: boolean) => void;
  onBulkTimeToggle: (period: TimePeriod, timeType: 'start' | 'end') => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  names,
  attendance,
  isAfternoon,
  onPresenceToggle,
  onToggleTime,
  onLongPress,
  onMouseUp,
  onClearEndTime,
  onBulkPresenceToggle,
  onBulkTimeToggle,
}) => {
  return (
    <View className="flex-1" style={{ minWidth: 800 }}>
      <ScrollView className="p-10"
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={{ minWidth: '100%' }}
      >
        <View style={{ minWidth: 800 }} className="rounded-md">
          <ScrollView showsVerticalScrollIndicator={false} className="rounded-md border-3 border-gray-300">
            <AttendanceTableHeader 
              isAfternoon={isAfternoon}
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
                onPresenceToggle={onPresenceToggle}
                onToggleTime={onToggleTime}
                onLongPress={onLongPress}
                onMouseUp={onMouseUp}
                onClearEndTime={onClearEndTime}
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};
