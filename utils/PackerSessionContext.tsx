import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { db } from './api/supabase';
import { useAuth } from './AuthContext';

// Types for session management
interface PackerSession {
  id?: string;
  packer_id: string;
  order_id?: string;
  order_name?: string;
  client_name?: string;
  project_lead_name?: string;
  team_selected: boolean;
  attendance_completed: boolean;
  packaging_started: boolean;
  session_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PackerSessionContextType {
  session: PackerSession | null;
  loading: boolean;
  
  // Session management
  createSession: (orderId: string, orderData: any) => Promise<boolean>;
  updateSession: (updates: Partial<PackerSession>) => Promise<boolean>;
  completeSession: () => Promise<boolean>;
  clearSession: () => void;
  
  // Progress tracking
  markTeamSelected: () => Promise<boolean>;
  markAttendanceCompleted: () => Promise<boolean>;
  markPackagingStarted: () => Promise<boolean>;
  
  // Validation helpers
  canAccessAttendance: () => boolean;
  canAccessPackaging: () => boolean;
}

const PackerSessionContext = createContext<PackerSessionContextType | undefined>(undefined);

export const usePackerSession = () => {
  const context = useContext(PackerSessionContext);
  if (!context) {
    throw new Error('usePackerSession must be used within a PackerSessionProvider');
  }
  return context;
};

interface PackerSessionProviderProps {
  children: ReactNode;
}

export const PackerSessionProvider: React.FC<PackerSessionProviderProps> = ({ children }) => {
  const { profile } = useAuth();
  const [session, setSession] = useState<PackerSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing session on mount
  useEffect(() => {
    if (profile?.id) {
      loadExistingSession();
    }
  }, [profile?.id]);

  const loadExistingSession = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      // Check for active session in database
      const { data, error } = await db.getActivePackerSession(profile.id);
      
      if (error) {
        console.error('Error loading session:', error);
        // Set session to null on error to ensure we're in a clean state
        setSession(null);
      } else if (data) {
        setSession(data);
        console.log('Loaded existing session:', data);
      } else {
        // No active session found - this is normal for new users or completed sessions
        setSession(null);
        console.log('No active session found - user can start fresh');
      }
    } catch (error) {
      console.error('Error in loadExistingSession:', error);
      // Set session to null on any unexpected error
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (orderId: string, orderData: any): Promise<boolean> => {
    if (!profile?.id) {
      Alert.alert('Error', 'User not authenticated');
      return false;
    }

    try {
      // First, check if there are any existing active sessions for this order
      const { data: existingSessions } = await db.getActiveSessionsForOrder(orderId);
      
      if (existingSessions && existingSessions.length > 0) {
        // If sessions exist for this order, check if current user has one
        const userSession = existingSessions.find(s => s.packer_id === profile.id);
        if (userSession) {
          setSession(userSession);
          console.log('Loaded existing team session for user:', userSession);
          return true;
        }
      }

      // Create individual session for current user
      const sessionData: Omit<PackerSession, 'id' | 'created_at' | 'updated_at'> = {
        packer_id: profile.id,
        order_id: orderId,
        order_name: orderData.order_name,
        client_name: orderData.client_name,
        project_lead_name: orderData.project_lead_name,
        team_selected: true, // Since we're creating after team selection
        attendance_completed: false,
        packaging_started: false,
        session_active: true
      };

      const { data, error } = await db.createPackerSession(sessionData);
      
      if (error) {
        console.error('Error creating session:', error);
        Alert.alert('Error', 'Failed to create work session');
        return false;
      }

      setSession(data);
      console.log('Created new session:', data);
      return true;
    } catch (error) {
      console.error('Error in createSession:', error);
      Alert.alert('Error', 'An unexpected error occurred');
      return false;
    }
  };

  const updateSession = async (updates: Partial<PackerSession>): Promise<boolean> => {
    if (!session?.id) {
      console.error('No active session to update');
      return false;
    }

    try {
      const { data, error } = await db.updatePackerSession(session.id, updates);
      
      if (error) {
        console.error('Error updating session:', error);
        return false;
      }

      setSession({ ...session, ...updates });
      console.log('Updated session:', updates);
      return true;
    } catch (error) {
      console.error('Error in updateSession:', error);
      return false;
    }
  };

  const completeSession = async (): Promise<boolean> => {
    if (!session?.id) return false;

    try {
      const { error } = await db.updatePackerSession(session.id, { 
        session_active: false,
        packaging_started: true
      });
      
      if (error) {
        console.error('Error completing session:', error);
        return false;
      }

      setSession(null);
      console.log('Session completed and cleared');
      return true;
    } catch (error) {
      console.error('Error in completeSession:', error);
      return false;
    }
  };

  const clearSession = () => {
    setSession(null);
  };

  // Progress tracking helpers
  const markTeamSelected = async (): Promise<boolean> => {
    return await updateSession({ team_selected: true });
  };

  const markAttendanceCompleted = async (): Promise<boolean> => {
    return await updateSession({ attendance_completed: true });
  };

  const markPackagingStarted = async (): Promise<boolean> => {
    return await updateSession({ packaging_started: true });
  };

  // Validation helpers
  const canAccessAttendance = (): boolean => {
    return session?.team_selected === true;
  };

  const canAccessPackaging = (): boolean => {
    return session?.team_selected === true && session?.attendance_completed === true;
  };

  const value: PackerSessionContextType = {
    session,
    loading,
    createSession,
    updateSession,
    completeSession,
    clearSession,
    markTeamSelected,
    markAttendanceCompleted,
    markPackagingStarted,
    canAccessAttendance,
    canAccessPackaging
  };

  return (
    <PackerSessionContext.Provider value={value}>
      {children}
    </PackerSessionContext.Provider>
  );
};
