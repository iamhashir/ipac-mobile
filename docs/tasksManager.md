Component Name: PackingTasksManager

Purpose:
A task management interface for the packing section of the app. Uses a tab-based layout to organize and navigate between multiple task views without flooding the screen.

Core Behavior
Tab System
There are multiple tabs inside this component.
Tab 1 (Overview Tab) — Always the first tab.
	Shows a Tasks Log list of tasks.
	Each task row displays:
		Task name
		Status (e.g., "In Progress" or "Completed").
	Clicking a task row navigates to that task’s detail tab.
Detail Tabs — Created dynamically when a new task is added.
	Each task gets its own tab.
	Tabs display:
		Date
		Task name
		Start time / End time inputs.
		Additional fields (e.g., Assign Packers).
		Start/Finish button.
	Pressing "Start":
		Saves entered info.
		Navigates back to the Overview Tab.
	Pressing "Finish":
		Updates the task status to "Completed".
		Navigates back to the Overview Tab.

Workflow
User starts in Overview Tab (Tab 1) → sees all tasks in progress or completed.
User clicks Add Task → a new detail tab opens.
User fills in task details and clicks Start → tab closes → returns to Overview.
User clicks an existing task row in Overview → opens the corresponding detail tab.
In the detail tab, user can click Finish → task marked completed → returns to Overview.

UI Elements

Overview Tab
	Header: "Tasks log"
	Task list: Scrollable list of task rows.
	Row layout: { Task Name } { Status }
	Status can be: "In progress" / "Completed".

Detail Tab
	Header: "Tasks log"
		Fields:
		Date (auto)
		Tasks (input)
		Start time (auto)
		End time (auto)
		Assign Packers
	Action Button: "Start" or "Finish" depending on status.

Navigation Rules
	Tabs are inside this component (not app-wide navigation).
	Tab switching is local to this component and should persist tab state until closed.\
	Closing a detail tab returns user to Overview Tab.


```
// PackingTasksManager.js
import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from "react-native";

// Simple tab header
const TabHeader = ({ tabs, activeTab, onChangeTab }) => (
  <View style={styles.tabHeader}>
    {tabs.map((tab, index) => (
      <TouchableOpacity
        key={index}
        style={[styles.tabButton, activeTab === index && styles.activeTab]}
        onPress={() => onChangeTab(index)}
      >
        <Text style={styles.tabText}>{tab.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export default function PackingTasksManager() {
  const [tabs, setTabs] = useState([
    { label: "Overview", type: "overview" } // first tab is always Overview
  ]);
  const [activeTab, setActiveTab] = useState(0);

  const [tasks, setTasks] = useState([
    { id: 1, name: "Consolidate", status: "In progress" }
  ]);

  const handleAddTask = () => {
    const newTaskId = tasks.length + 1;
    const newTask = {
      id: newTaskId,
      name: "",
      date: "",
      startTime: "",
      endTime: "",
      status: "Pending"
    };
    setTasks([...tasks, newTask]);
    setTabs([...tabs, { label: `Task ${newTaskId}`, type: "detail", taskId: newTaskId }]);
    setActiveTab(tabs.length); // switch to new tab
  };

  const handleStartTask = (taskId, updatedFields) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, ...updatedFields, status: "In progress" } : task
    ));
    setActiveTab(0); // go back to overview
  };

  const handleFinishTask = (taskId) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, status: "Completed" } : task
    ));
    setActiveTab(0);
  };

  const renderOverview = () => (
    <View style={styles.tabContent}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>Tasks log</Text>
      </View>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.taskRow}
            onPress={() => {
              // open the detail tab for this task if not already there
              const existingTabIndex = tabs.findIndex(t => t.taskId === item.id);
              if (existingTabIndex >= 0) {
                setActiveTab(existingTabIndex);
              } else {
                setTabs([...tabs, { label: `Task ${item.id}`, type: "detail", taskId: item.id }]);
                setActiveTab(tabs.length);
              }
            }}
          >
            <Text>{item.name || `Task ${item.id}`}</Text>
            <Text>{item.status}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.addTaskButton} onPress={handleAddTask}>
        <Text style={{ color: "#fff" }}>+ Add Task</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTaskDetail = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return null;

    const updateField = (field, value) => {
      setTasks(tasks.map(t =>
        t.id === taskId ? { ...t, [field]: value } : t
      ));
    };

    return (
      <View style={styles.tabContent}>
        <Text style={styles.headerText}>Tasks log</Text>

        <Text>Date</Text>
        <TextInput
          style={styles.input}
          value={task.date}
          onChangeText={(val) => updateField("date", val)}
          placeholder="YYYY-MM-DD"
        />

        <Text>Tasks</Text>
        <TextInput
          style={styles.input}
          value={task.name}
          onChangeText={(val) => updateField("name", val)}
          placeholder="Task name"
        />

        <Text>Start time</Text>
        <TextInput
          style={styles.input}
          value={task.startTime}
          onChangeText={(val) => updateField("startTime", val)}
          placeholder="HH:MM"
        />

        <Text>End time</Text>
        <TextInput
          style={styles.input}
          value={task.endTime}
          onChangeText={(val) => updateField("endTime", val)}
          placeholder="HH:MM"
        />

        <Text>Assign Packers</Text>
        <TextInput
          style={styles.input}
          value={task.assignPackers || ""}
          onChangeText={(val) => updateField("assignPackers", val)}
          placeholder="Names"
        />

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (task.status === "Pending") {
              handleStartTask(taskId, { startTime: task.startTime });
            } else {
              handleFinishTask(taskId);
            }
          }}
        >
          <Text style={{ color: "#fff" }}>
            {task.status === "Pending" ? "Start" : "Finish"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TabHeader
        tabs={tabs}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />
      {tabs[activeTab].type === "overview"
        ? renderOverview()
        : renderTaskDetail(tabs[activeTab].taskId)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  tabHeader: { flexDirection: "row", backgroundColor: "#222" },
  tabButton: { padding: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: "green" },
  tabText: { color: "#fff" },
  tabContent: { padding: 16 },
  headerText: { fontSize: 18, color: "#fff", marginBottom: 8 },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8
  },
  input: {
    backgroundColor: "#222",
    color: "#fff",
    padding: 10,
    marginBottom: 8,
    borderRadius: 6
  },
  addTaskButton: {
    marginTop: 12,
    backgroundColor: "green",
    padding: 12,
    borderRadius: 6,
    alignItems: "center"
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: "green",
    padding: 12,
    borderRadius: 6,
    alignItems: "center"
  }
});
```


How It Works
tabs state keeps track of the tab labels and what each tab represents.
tasks state stores all task details.
The Overview Tab lists tasks and allows adding new ones.
Clicking a row in the overview either opens an existing detail tab or creates a new one for that task.
Detail Tabs let you fill in task info, start tasks, and finish them.
Navigation between tabs is local to the component, not the entire app.