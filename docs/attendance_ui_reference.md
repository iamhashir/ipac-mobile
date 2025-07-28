main scrreen file Attedance.tsx
--------------------------------------------------------------------------------------------------------------------------------------------------------------

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Clock } from "../components/Clock";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { NavigationIcons } from "../components/NavigationIcons";
import { 
  AttendanceRecord, 
  ProjectAttendance, 
  TimePeriod 
} from "../types/attendance";
import { 
  isValidTimeForPeriod, 
  getDefaultTime, 
  getCurrentTimeString, 
  getTodayFormatted,
  isAfternoonNow
} from "../utils/attendanceUtils";
import { ProjectHeader } from "../components/attendance/ProjectHeader";
import { NoProjectSelected } from "../components/attendance/NoProjectSelected";
import { ProjectNotFound } from "../components/attendance/ProjectNotFound";
import { AttendanceTable } from "../components/attendance/AttendanceTable";

const AttendanceSheet = () => {
  const navigate = useNavigate();
  const isAfternoon = isAfternoonNow();
  
  // Get project assignments from local storage
  const { value: assignments = {}, setValue: setAssignments } = useLocalStorage<Record<string, { 
    packers: string[], 
    lead: string 
  }>>('project-assignments', {});

  // Get current selections from local storage
  const { value: currentSelections = {
    selectedProject: null,
    selectedPackers: [],
    projectLead: null
  }, setValue: setCurrentSelections } = useLocalStorage<{
    selectedProject: string | null;
    selectedPackers: string[];
    projectLead: string | null;
  }>('current-selections', {
    selectedProject: null,
    selectedPackers: [],
    projectLead: null
  });

  // Get attendance records from local storage
  const { value: attendanceRecords = {}, setValue: setAttendanceRecords } = 
    useLocalStorage<ProjectAttendance>('attendance-records', {});

  // Get toolbox state from local storage
  const { value: globalToolboxState = {}, setValue: setGlobalToolboxState } = 
    useLocalStorage<Record<string, boolean>>('global-toolbox-state', {});

  // State to track the selected project
  const [selectedProject, setSelectedProject] = useState<string | null>(currentSelections.selectedProject);
  
  // State to track toolbox confirmation
  const [toolboxCompleted, setToolboxCompleted] = useState(false);
  
  // State to track attendance for the selected project
  const [attendance, setAttendance] = useState<AttendanceRecord>({});

  // Timer reference for long press - using useRef instead of useState
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // State to track loading status
  const [isLoading, setIsLoading] = useState(true);

  // Debug logging
  useEffect(() => {
    console.log("assignments:", assignments);
    console.log("currentSelections:", currentSelections);
    console.log("selectedProject:", selectedProject);
  }, [assignments, currentSelections, selectedProject]);

  // Ensure we have project data
  useEffect(() => {
    // If we have a project in currentSelections but not in assignments, add it
    if (currentSelections.selectedProject && 
        currentSelections.projectLead && 
        currentSelections.selectedPackers.length > 0 && 
        Object.keys(assignments).length === 0) {
      
      const projectAssignments = {
        ...assignments,
        [currentSelections.selectedProject]: {
          packers: currentSelections.selectedPackers,
          lead: currentSelections.projectLead
        }
      };
      
Lovable - Build for the web 20x faster

--------------------------------------------------------------------------------------------------------------------------------------------------------------

--------------------------------------------------------------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------------------------------------------------------


componenets:

ProjectHeader.tsx
--------------------------------------------------------------------------------------------------------------------------------------------------------------

import React from "react";

interface ProjectHeaderProps {
  projectName: string;
  projectLead: string;
  packers: string[];
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ 
  projectName, 
  projectLead, 
  packers 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div>
        <h3 className="font-medium text-gray-500">Project:</h3>
        <p className="text-lg font-semibold">{projectName}</p>
      </div>
      <div>
        <h3 className="font-medium text-gray-500">Project Lead:</h3>
        <p className="text-lg font-semibold">{projectLead}</p>
      </div>
      
      {packers.length > 0 && (
        <div className="col-span-1 md:col-span-2">
          <h3 className="font-medium text-gray-500">Team Members:</h3>
          <p className="text-lg">{packers.join(", ")}</p>
        </div>
      )}
    </div>
  );
};


--------------------------------------------------------------------------------------------------------------------------------------------------------------



ProjectNotFound.tsx
--------------------------------------------------------------------------------------------------------------------------------------------------------------
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Clock } from "../Clock";
import { NavigationIcons } from "../NavigationIcons";

interface ProjectNotFoundProps {
  projectName: string;
  projectList?: string[];
  onSelectProject?: (project: string) => void;
}

export const ProjectNotFound: React.FC<ProjectNotFoundProps> = ({
  projectName,
  projectList,
  onSelectProject
}) => {
  const navigate = useNavigate();

  const preventTouchVibration = (e: React.TouchEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-[#D3E4FD] text-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Collaborative Data Assistant</h1>
          <div className="flex items-center gap-4">
            <Clock />
            <NavigationIcons />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-medium mb-4 bg-[#0EA5E9] text-white p-2 rounded">
            Attendance Sheet & Tool Box
          </h2>
          
          <p className="text-center py-4 text-lg font-medium">Projet non trouvé</p>
          <p className="text-center py-2">
            Le projet "{projectName}" n'existe pas dans les assignations.
          </p>
          
          {projectList && projectList.length > 0 && (
            <div className="py-4">
              <p className="text-center mb-4">Veuillez sélectionner un projet valide dans la liste ci-dessous:</p>
              <div className="space-y-2 max-w-md mx-auto">
                {projectList.map(projectName => (
                  <button
                    key={projectName}
                    onClick={() => onSelectProject && onSelectProject(projectName)}
                    className="w-full p-3 text-left border rounded-md hover:bg-blue-50 transition-colors"
                  >
                    {projectName}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-center mt-4">
            <Button 
              onClick={() => navigate("/")}
              className="bg-[#1EAEDB] hover:bg-[#0FA0CE] text-white"
              onTouchStart={preventTouchVibration}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la page principale
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};


--------------------------------------------------------------------------------------------------------------------------------------------------------------


NoProjectSelected.tsx
--------------------------------------------------------------------------------------------------------------------------------------------------------------
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Clock } from "../Clock";
import { NavigationIcons } from "../NavigationIcons";

interface NoProjectSelectedProps {
  message?: string;
  projectList?: string[];
  onSelectProject?: (project: string) => void;
}

export const NoProjectSelected: React.FC<NoProjectSelectedProps> = ({
  message,
  projectList,
  onSelectProject
}) => {
  const navigate = useNavigate();
  
  const preventTouchVibration = (e: React.TouchEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-[#D3E4FD] text-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Collaborative Data Assistant</h1>
          <div className="flex items-center gap-4">
            <Clock />
            <NavigationIcons />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-medium mb-4 bg-[#0EA5E9] text-white p-2 rounded">
            Attendance Sheet & Tool Box
          </h2>
          
          <p className="text-center py-4 text-lg font-medium">No project selected.</p>
          
          {message && <p className="text-center py-2">{message}</p>}
          
          {projectList && projectList.length > 0 && (
            <div className="py-4">
              <p className="text-center mb-4">Please select a project from the list below:</p>
              <div className="space-y-2 max-w-md mx-auto">
                {projectList.map(projectName => (
                  <button
                    key={projectName}
                    onClick={() => onSelectProject && onSelectProject(projectName)}
                    className="w-full p-3 text-left border rounded-md hover:bg-blue-50 transition-colors"
                  >
                    {projectName}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-center mt-4">
            <Button 
              onClick={() => navigate("/")}
              className="bg-[#1EAEDB] hover:bg-[#0FA0CE] text-white"
              onTouchStart={preventTouchVibration}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Main Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};


--------------------------------------------------------------------------------------------------------------------------------------------------------------


AttendanceTable.tsx
--------------------------------------------------------------------------------------------------------------------------------------------------------------
import React from "react";
import { AttendanceTableHeader } from "./AttendanceTableHeader";
import { AttendanceRow } from "./AttendanceRow";
import { AttendanceRecord, TimePeriod } from "../../types/attendance";

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
  preventTouchVibration: (e: React.TouchEvent) => void;
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
  preventTouchVibration
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <AttendanceTableHeader 
          isAfternoon={isAfternoon}
          onBulkPresenceToggle={onBulkPresenceToggle}
          onBulkTimeToggle={onBulkTimeToggle}
        />
        <tbody>
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
              preventTouchVibration={preventTouchVibration}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
--------------------------------------------------------------------------------------------------------------------------------------------------------------


AttendanceTableHeader.tsx
--------------------------------------------------------------------------------------------------------------------------------------------------------------
import React from "react";
import { CheckCircle, XCircle, Clock as ClockIcon } from "lucide-react";
import { TimePeriod } from "../../types/attendance";

interface AttendanceTableHeaderProps {
  isAfternoon: boolean;
  onBulkPresenceToggle: (period: TimePeriod, isPresent: boolean) => void;
  onBulkTimeToggle: (period: TimePeriod, timeType: 'start' | 'end') => void;
}

export const AttendanceTableHeader: React.FC<AttendanceTableHeaderProps> = ({
  isAfternoon,
  onBulkPresenceToggle,
  onBulkTimeToggle
}) => {
  return (
    <thead>
      <tr className="bg-[#D3E4FD]">
        <th className="p-2 border text-left w-[15%]">Name</th>
        <th className="p-2 border text-center" colSpan={3}>
          <div className="flex items-center justify-center">
            <span className="font-medium">
              Morning
              {isAfternoon && <span className="text-red-500 ml-1">(Disabled after 12:00)</span>}
            </span>
          </div>
        </th>
        <th className="p-2 border text-center" colSpan={3}>
          <div className="flex items-center justify-center">
            <span className="font-medium">Afternoon</span>
          </div>
        </th>
      </tr>
      <tr className="bg-[#E8F2FD]">
        <th className="p-2 border"></th>
        <th className="p-2 border text-center w-[14%]">
          <div className="flex flex-col items-center">
            <span className="text-xs mb-1">Present / Absent</span>
            <div className="flex items-center gap-1 justify-center">
              <button 
                className={`hover:bg-blue-100 rounded-full p-1 ${isAfternoon ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => onBulkPresenceToggle('morning', true)}
                title="Mark all present for morning"
                disabled={isAfternoon}
              >
                <CheckCircle size={32} className="text-green-600" />
              </button>
              <button 
                className="hover:bg-blue-100 rounded-full p-1"
                onClick={() => onBulkPresenceToggle('morning', false)}
                title="Mark all absent for morning"
              >
                <XCircle size={32} className="text-red-600" />
              </button>
            </div>
          </div>
        </th>
        <th className="p-2 border text-center w-[14%]">
          <div className="flex items-center justify-center">
            <button 
              className={`hover:bg-blue-100 rounded-full p-1 ${isAfternoon ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => onBulkTimeToggle('morning', 'start')}
              title="Set start time for all present in morning"
              disabled={isAfternoon}
            >
              <ClockIcon size={20} className="text-blue-600" />
              <span className="ml-1">Start</span>
            </button>
          </div>
        </th>
        <th className="p-2 border text-center w-[14%]">
          <div className="flex items-center justify-center">
            <button 
              className={`hover:bg-blue-100 rounded-full p-1 ${isAfternoon ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => onBulkTimeToggle('morning', 'end')}
              title="Set end time for all present in morning"
              disabled={isAfternoon}
            >
              <ClockIcon size={20} className="text-blue-800" />
              <span className="ml-1">End</span>
            </button>
          </div>
        </th>
        <th className="p-2 border text-center w-[14%]">
          <div className="flex flex-col items-center">
            <span className="text-xs mb-1">Present / Absent</span>
            <div className="flex items-center gap-1 justify-center">
              <button 
                className="hover:bg-blue-100 rounded-full p-1"
                onClick={() => onBulkPresenceToggle('afternoon', true)}
                title="Mark all present for afternoon"
              >
                <CheckCircle size={32} className="text-green-600" />
              </button>
              <button 
                className="hover:bg-blue-100 rounded-full p-1"
                onClick={() => onBulkPresenceToggle('afternoon', false)}
                title="Mark all absent for afternoon"
              >
                <XCircle size={32} className="text-red-600" />
              </button>
            </div>
          </div>
        </th>
        <th className="p-2 border text-center w-[14%]">
          <div className="flex items-center justify-center">
            <button 
              className="hover:bg-blue-100 rounded-full p-1"
              onClick={() => onBulkTimeToggle('afternoon', 'start')}
              title="Set start time for all present in afternoon"
            >
              <ClockIcon size={20} className="text-blue-600" />
              <span className="ml-1">Start</span>
            </button>
          </div>
        </th>
        <th className="p-2 border text-center w-[14%]">
          <div className="flex items-center justify-center">
            <button 
              className="hover:bg-blue-100 rounded-full p-1"
              onClick={() => onBulkTimeToggle('afternoon', 'end')}
              title="Set end time for all present in afternoon"
            >
              <ClockIcon size={20} className="text-blue-800" />
              <span className="ml-1">End</span>
            </button>
          </div>
        </th>
      </tr>
    </thead>
  );
};
--------------------------------------------------------------------------------------------------------------------------------------------------------------


AttendanceRow.tsx
--------------------------------------------------------------------------------------------------------------------------------------------------------------
import React from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttendanceEntry, TimePeriod } from "../../types/attendance";

interface AttendanceRowProps {
  name: string;
  attendance: AttendanceEntry;
  isAfternoon: boolean;
  onPresenceToggle: (name: string, period: TimePeriod, isPresent: boolean) => void;
  onToggleTime: (name: string, period: TimePeriod, timeType: 'start' | 'end') => void;
  onLongPress: (name: string, period: TimePeriod, timeType: 'start' | 'end') => void;
  onMouseUp: () => void;
  onClearEndTime: (name: string, period: TimePeriod) => void;
  preventTouchVibration: (e: React.TouchEvent) => void;
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({
  name,
  attendance,
  isAfternoon,
  onPresenceToggle,
  onToggleTime,
  onLongPress,
  onMouseUp,
  onClearEndTime,
  preventTouchVibration
}) => {
  return (
    <tr className="border-b">
      <td className="p-2 border font-medium">{name}</td>
      
      {/* Morning Presence */}
      <td className="p-2 border">
        <div className="flex flex-col items-center">
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              variant={attendance.morning.present === true ? "default" : "outline"}
              className={`${attendance.morning.present === true ? "bg-[#0EA5E9] hover:bg-[#0FA0CE]" : "border-[#33C3F0] text-[#33C3F0]"} ${isAfternoon ? 'opacity-50' : ''}`}
              onClick={() => onPresenceToggle(name, 'morning', true)}
              onTouchStart={preventTouchVibration}
              disabled={isAfternoon}
            >
              <CheckCircle size={20} className="mr-1" />
              <span className="text-xs">Present</span>
            </Button>
            <Button
              size="sm"
              variant={attendance.morning.present === false ? "default" : "outline"}
              className={attendance.morning.present === false ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => onPresenceToggle(name, 'morning', false)}
              onTouchStart={preventTouchVibration}
            >
              <XCircle size={20} className="mr-1" />
              <span className="text-xs">Absent</span>
            </Button>
          </div>
        </div>
      </td>
      
      {/* Morning Start Time */}
      <td className="p-2 border">
        <button
          className={`w-full p-2 rounded flex items-center justify-center ${
            !attendance.morning.present || isAfternoon
              ? "bg-gray-100 cursor-not-allowed"
              : attendance.morning.startTime
                ? "bg-[#215732] text-white hover:bg-green-800"
                : "bg-blue-100 hover:bg-blue-200"
          }`}
          disabled={!attendance.morning.present || isAfternoon}
          onClick={() => onToggleTime(name, 'morning', 'start')}
          onMouseDown={() => onLongPress(name, 'morning', 'start')}
          onMouseUp={onMouseUp}
          onTouchStart={(e) => {
            preventTouchVibration(e);
            if (!isAfternoon) {
              onLongPress(name, 'morning', 'start');
            }
          }}
          onTouchEnd={onMouseUp}
        >
          {attendance.morning.startTime ? (
            <span className="text-lg font-bold">
              {attendance.morning.startTime}
            </span>
          ) : (
            "Start"
          )}
        </button>
      </td>
      
      {/* Morning End Time */}
      <td className="p-2 border">
        <div className="flex gap-1">
          <button
            className={`flex-grow p-2 rounded flex items-center justify-center ${
              !attendance.morning.present || !attendance.morning.startTime || isAfternoon
                ? "bg-gray-100 cursor-not-allowed"
                : attendance.morning.endTime
                  ? "bg-[#215732] text-white hover:bg-green-800"
                  : "bg-blue-100 hover:bg-blue-200"
            }`}
            disabled={!attendance.morning.present || !attendance.morning.startTime || isAfternoon}
            onClick={() => onToggleTime(name, 'morning', 'end')}
            onMouseDown={() => onLongPress(name, 'morning', 'end')}
            onMouseUp={onMouseUp}
            onTouchStart={(e) => {
              preventTouchVibration(e);
              if (!isAfternoon) {
                onLongPress(name, 'morning', 'end');
              }
            }}
            onTouchEnd={onMouseUp}
          >
            {attendance.morning.endTime ? (
              <span className="text-lg font-bold">
                {attendance.morning.endTime}
              </span>
            ) : (
              "End"
            )}
          </button>
          
          {attendance.morning.endTime && !isAfternoon && (
            <button
              className="p-2 bg-red-100 hover:bg-red-200 rounded"
              onClick={() => onClearEndTime(name, 'morning')}
              title="Clear end time"
            >
              <XCircle size={20} className="text-red-600" />
            </button>
          )}
        </div>
      </td>
      
      {/* Afternoon Presence */}
      <td className="p-2 border">
        <div className="flex flex-col items-center">
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              variant={attendance.afternoon.present === true ? "default" : "outline"}
              className={attendance.afternoon.present === true ? "bg-[#0EA5E9] hover:bg-[#0FA0CE]" : "border-[#33C3F0] text-[#33C3F0]"}
              onClick={() => onPresenceToggle(name, 'afternoon', true)}
              onTouchStart={preventTouchVibration}
            >
              <CheckCircle size={20} className="mr-1" />
              <span className="text-xs">Present</span>
            </Button>
            <Button
              size="sm"
              variant={attendance.afternoon.present === false ? "default" : "outline"}
              className={attendance.afternoon.present === false ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => onPresenceToggle(name, 'afternoon', false)}
              onTouchStart={preventTouchVibration}
            >
              <XCircle size={20} className="mr-1" />
              <span className="text-xs">Absent</span>
            </Button>
          </div>
        </div>
      </td>
      
      {/* Afternoon Start Time */}
      <td className="p-2 border">
        <button
          className={`w-full p-2 rounded flex items-center justify-center ${
            !attendance.afternoon.present
              ? "bg-gray-100 cursor-not-allowed"
              : attendance.afternoon.startTime
                ? "bg-[#215732] text-white hover:bg-green-800"
                : "bg-blue-100 hover:bg-blue-200"
          }`}
          disabled={!attendance.afternoon.present}
          onClick={() => onToggleTime(name, 'afternoon', 'start')}
          onMouseDown={() => onLongPress(name, 'afternoon', 'start')}
          onMouseUp={onMouseUp}
          onTouchStart={(e) => {
            preventTouchVibration(e);
            onLongPress(name, 'afternoon', 'start');
          }}
          onTouchEnd={onMouseUp}
        >
          {attendance.afternoon.startTime ? (
            <span className="text-lg font-bold">
              {attendance.afternoon.startTime}
            </span>
          ) : (
            "Start"
          )}
        </button>
      </td>
      
      {/* Afternoon End Time */}
      <td className="p-2 border">
        <div className="flex gap-1">
          <button
            className={`flex-grow p-2 rounded flex items-center justify-center ${
              !attendance.afternoon.present || !attendance.afternoon.startTime
                ? "bg-gray-100 cursor-not-allowed"
                : attendance.afternoon.endTime
                  ? "bg-[#215732] text-white hover:bg-green-800"
                  : "bg-blue-100 hover:bg-blue-200"
            }`}
            disabled={!attendance.afternoon.present || !attendance.afternoon.startTime}
            onClick={() => onToggleTime(name, 'afternoon', 'end')}
            onMouseDown={() => onLongPress(name, 'afternoon', 'end')}
            onMouseUp={onMouseUp}
            onTouchStart={(e) => {
              preventTouchVibration(e);
              onLongPress(name, 'afternoon', 'end');
            }}
            onTouchEnd={onMouseUp}
          >
            {attendance.afternoon.endTime ? (
              <span className="text-lg font-bold">
                {attendance.afternoon.endTime}
              </span>
            ) : (
              "End"
            )}
          </button>
          
          {attendance.afternoon.endTime && (
            <button
              className="p-2 bg-red-100 hover:bg-red-200 rounded"
              onClick={() => onClearEndTime(name, 'afternoon')}
              title="Clear end time"
            >
              <XCircle size={20} className="text-red-600" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

--------------------------------------------------------------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------------------------------------------------------