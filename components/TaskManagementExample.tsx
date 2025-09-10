import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { db } from '../utils/api/supabase';

interface TaskStatus {
  task_log_id: string;
  task_name: string;
  overall_status: 'in_progress' | 'paused' | 'completed';
  assigned_packers: Array<{
    packer_id: string;
    full_name: string;
    status: string;
  }>;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  pause_duration?: number;
  update_counter: number;
}

const TaskManagementExample: React.FC = () => {
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pauseTimestamps, setPauseTimestamps] = useState<Record<string, Date>>({});

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const { data, error } = await db.getTaskStatusView();
      if (error) {
        console.error('Error loading tasks:', error);
        Alert.alert('Error', 'Failed to load tasks');
        return;
      }
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      Alert.alert('Error', 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (taskLogId: string) => {
    try {
      const { data, error } = await db.completeTask(taskLogId);
      if (error) {
        Alert.alert('Error', 'Failed to complete task');
        return;
      }
      
      Alert.alert('Success', `Task completed successfully! Duration: ${data.duration_minutes} minutes`);
      await loadTasks(); // Refresh the list
    } catch (error) {
      console.error('Error completing task:', error);
      Alert.alert('Error', 'Failed to complete task');
    }
  };

  const handlePause = async (taskLogId: string) => {
    try {
      // Record the pause start time
      setPauseTimestamps(prev => ({
        ...prev,
        [taskLogId]: new Date()
      }));

      const { data, error } = await db.pauseTask(taskLogId);
      if (error) {
        Alert.alert('Error', 'Failed to pause task');
        return;
      }
      
      Alert.alert('Success', 'Task paused successfully');
      await loadTasks(); // Refresh the list
    } catch (error) {
      console.error('Error pausing task:', error);
      Alert.alert('Error', 'Failed to pause task');
    }
  };

  const handleUnpause = async (taskLogId: string) => {
    try {
      // Calculate pause duration if we have a pause timestamp
      let pauseDurationSeconds = null;
      if (pauseTimestamps[taskLogId]) {
        const pauseStart = pauseTimestamps[taskLogId];
        pauseDurationSeconds = Math.floor((new Date().getTime() - pauseStart.getTime()) / 1000);
      }

      const { data, error } = await db.unpauseTask(taskLogId, pauseDurationSeconds);
      if (error) {
        Alert.alert('Error', 'Failed to resume from pause');
        return;
      }
      
      // Clear the pause timestamp
      setPauseTimestamps(prev => {
        const newTimestamps = { ...prev };
        delete newTimestamps[taskLogId];
        return newTimestamps;
      });

      Alert.alert('Success', 'Task resumed from pause');
      await loadTasks(); // Refresh the list
    } catch (error) {
      console.error('Error resuming task:', error);
      Alert.alert('Error', 'Failed to resume task');
    }
  };

  const handleResume = async (taskLogId: string) => {
    try {
      // First check if the task can be resumed
      const { data: canResumeData, error: canResumeError } = await db.canResumeTask(taskLogId);
      if (canResumeError) {
        Alert.alert('Error', 'Failed to check task resume eligibility');
        return;
      }

      if (!canResumeData.can_resume) {
        Alert.alert(
          'Cannot Resume Task',
          canResumeData.message + '\n\nWould you like to create a new task with available packers instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Create New Task', onPress: () => {
              // Here you would implement creating a new task with available packers
              Alert.alert('Info', 'This would redirect to create a new task with available packers');
            }}
          ]
        );
        return;
      }

      // Proceed with resuming the task
      const { data, error } = await db.resumeTask(taskLogId);
      if (error) {
        Alert.alert('Error', 'Failed to resume task');
        return;
      }
      
      Alert.alert('Success', 'Task resumed successfully');
      await loadTasks(); // Refresh the list
    } catch (error) {
      console.error('Error resuming task:', error);
      Alert.alert('Error', 'Failed to resume task');
    }
  };

  const getTaskRowStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return [styles.taskRow, styles.completedTaskRow];
      case 'paused':
        return [styles.taskRow, styles.pausedTaskRow];
      default:
        return styles.taskRow;
    }
  };

  const renderTaskButtons = (task: TaskStatus) => {
    switch (task.overall_status) {
      case 'completed':
        // Rule: For completed tasks, only show resume button
        return (
          <TouchableOpacity
            style={styles.resumeButton}
            onPress={() => handleResume(task.task_log_id)}
          >
            <Text style={styles.buttonText}>Resume</Text>
          </TouchableOpacity>
        );
      
      case 'paused':
        // For paused tasks, show unpause button
        return (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.unpauseButton}
              onPress={() => handleUnpause(task.task_log_id)}
            >
              <Text style={styles.buttonText}>Resume from Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleComplete(task.task_log_id)}
            >
              <Text style={styles.buttonText}>Complete</Text>
            </TouchableOpacity>
          </View>
        );
      
      case 'in_progress':
      default:
        // For active tasks, show start/pause buttons
        return (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.pauseButton}
              onPress={() => handlePause(task.task_log_id)}
            >
              <Text style={styles.buttonText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleComplete(task.task_log_id)}
            >
              <Text style={styles.buttonText}>Complete</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Task Management</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadTasks}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {tasks.map((task) => (
          <View key={task.task_log_id} style={getTaskRowStyle(task.overall_status)}>
            <View style={styles.taskInfo}>
              <Text style={styles.taskName}>{task.task_name}</Text>
              <Text style={styles.taskStatus}>Status: {task.overall_status}</Text>
              <Text style={styles.taskDetails}>
                Started: {new Date(task.start_time).toLocaleString()}
              </Text>
              {task.end_time && (
                <Text style={styles.taskDetails}>
                  Completed: {new Date(task.end_time).toLocaleString()}
                </Text>
              )}
              {task.duration_minutes && (
                <Text style={styles.taskDetails}>
                  Duration: {task.duration_minutes} minutes
                </Text>
              )}
              {task.pause_duration && (
                <Text style={styles.taskDetails}>
                  Pause Duration: {task.pause_duration} seconds
                </Text>
              )}
              <Text style={styles.taskDetails}>
                Updates: {task.update_counter}
              </Text>
              <Text style={styles.assignedPackers}>
                Assigned: {task.assigned_packers?.map(p => p.full_name).join(', ')}
              </Text>
            </View>
            
            {renderTaskButtons(task)}
          </View>
        ))}
        
        {tasks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No tasks found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  taskRow: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  completedTaskRow: {
    backgroundColor: '#f8f8f8',
    opacity: 0.7,
  },
  pausedTaskRow: {
    backgroundColor: '#fff3cd',
  },
  taskInfo: {
    marginBottom: 12,
  },
  taskName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  taskStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  taskDetails: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  assignedPackers: {
    fontSize: 12,
    color: '#555',
    fontStyle: 'italic',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pauseButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
  },
  unpauseButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
  },
  completeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    flex: 1,
  },
  resumeButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
  },
});

export default TaskManagementExample;
