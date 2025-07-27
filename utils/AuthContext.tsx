import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, supabase } from './api/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Get initial session
    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      setSession(session);
      
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const getInitialSession = async () => {
    try {
      const { session, error } = await auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        setLoading(false);
        return;
      }

      setSession(session);
      
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error in getInitialSession:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId) => {
    try {
      console.log('👤 Loading user profile for userId:', userId);
      const { data, error } = await db.getUserProfile(userId);
      
      if (error) {
        console.error('❌ Error loading user profile:', error);
        console.log('❌ Profile error details:', JSON.stringify(error, null, 2));
        return;
      }

      if (data) {
        console.log('✅ Profile loaded successfully:', {
          name: data.full_name,
          role: data.roles?.name,
          status: data.status
        });
        setProfile(data);
      } else {
        console.log('⚠️ No profile data returned for user');
      }
    } catch (error) {
      console.error('💥 Error in loadUserProfile:', error);
    }
  };

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const { data, error } = await auth.signIn(email, password);
      return { data, error };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signInWithPhone = async (phone) => {
    try {
      setLoading(true);
      const { data, error } = await auth.signInWithPhone(phone);
      return { data, error };
    } catch (error) {
      console.error('Phone sign in error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (phone, token) => {
    try {
      setLoading(true);
      const { data, error } = await auth.verifyOtp(phone, token);
      return { data, error };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await auth.signOut();
      
      // Always clear the local state, even if there's an error
      setUser(null);
      setProfile(null);
      setSession(null);
      
      return { error };
    } catch (error) {
      console.error('Sign out error:', error);
      // Clear state even on error
      setUser(null);
      setProfile(null);
      setSession(null);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Helper functions to check user role and permissions
  const isAdmin = () => {
    return profile?.roles?.name === 'admin' || profile?.roles?.name === 'director';
  };

  const isPacker = () => {
    return profile?.roles?.name === 'packer';
  };

  const isProjectLead = (orderId?: string) => {
    // Check if user is assigned as project lead for a specific order
    if (!orderId || !profile) return false;
    // This would need to be checked against the order's project_lead_id
    // For now, return false - implement when needed
    return false;
  };

  const hasPermission = (permission) => {
    return profile?.roles?.[permission] === true;
  };

  const getUserRole = () => {
    return profile?.roles?.name || 'unknown';
  };

  const value = {
    user,
    profile,
    loading,
    session,
    signIn,
    signInWithPhone,
    verifyOtp,
    signOut,
    isAdmin,
    isPacker,
    isProjectLead,
    hasPermission,
    getUserRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
