import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db, supabase } from './api/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [lastAuthEvent, setLastAuthEvent] = useState(null);
  const profileLoadingRef = useRef(false);
  const sessionRefreshTimeoutRef = useRef(null);
  // Refs to avoid stale closures inside the auth listener
  const lastAuthEventRef = useRef(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Get initial session
    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignore TOKEN_REFRESHED events unless the user actually changed
      if (event === 'TOKEN_REFRESHED' && session?.user?.id === userIdRef.current) {
        console.log('Token refreshed for same user, skipping profile reload');
        setSession(session);
        return;
      }

      // Prevent duplicate SIGNED_IN events (use refs to avoid stale state in closure)
      if (event === 'SIGNED_IN' && lastAuthEventRef.current === 'SIGNED_IN' && session?.user?.id === userIdRef.current) {
        console.log('Duplicate SIGNED_IN event for same user, skipping');
        return;
      }

      console.log('Auth event:', event);
      setLastAuthEvent(event);
      lastAuthEventRef.current = event;
      setSession(session);
      
      if (session?.user) {
        const userChanged = session.user.id !== userIdRef.current;
        setUser(session.user);
        userIdRef.current = session.user.id;
        
        // Only load profile if user changed or we don't have a profile yet
        if (userChanged || !profile) {
          // Prevent concurrent profile loading
          if (!profileLoadingRef.current) {
            profileLoadingRef.current = true;
            try {
              await loadUserProfile(session.user.id);
            } catch (error) {
              console.error('💥 Profile loading failed:', error);
              // Do not clear existing profile on transient failures
            } finally {
              profileLoadingRef.current = false;
            }
          } else {
            console.log('Profile loading already in progress, skipping');
          }
        }
      } else {
        setUser(null);
        userIdRef.current = null;
        setProfile(null);
        profileLoadingRef.current = false;
      }
    });

    // Set up session refresh monitoring
    setupSessionRefresh();

    return () => {
      subscription?.unsubscribe();
      if (sessionRefreshTimeoutRef.current) {
        clearTimeout(sessionRefreshTimeoutRef.current);
      }
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
        userIdRef.current = session.user.id;
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
      // Skip if we already have this user's profile
      if (profile?.id === userId) {
        console.log('✓ Profile already loaded for user:', userId);
        return;
      }

      console.log('👤 Loading user profile for userId:', userId);
      
      const { data, error } = await db.getUserProfile(userId);
      
      if (error) {
        console.error('❌ Error loading user profile:', error);
        console.log('❌ Profile error details:', JSON.stringify(error, null, 2));
        
        // If there's an error loading profile, still set loading to false
        // This prevents infinite loading state
        setProfile(null);
        return;
      }

      let profileData = data;

      // Fallback: if roles relationship is missing, fetch role by role_id
      if (profileData && !profileData.roles && profileData.role_id) {
        try {
          const { data: roleRow } = await supabase
            .from('roles')
            .select('id, name, can_block_users, can_unblock_users, can_ban_users, can_reset_passwords, can_delete_profiles, can_manage_roles')
            .eq('id', profileData.role_id)
            .maybeSingle();
          if (roleRow) {
            profileData = { ...profileData, roles: roleRow };
          }
        } catch (e) {
          console.warn('⚠️ Could not load role separately:', e);
        }
      }

      if (profileData) {
        console.log('✅ Profile loaded successfully:', {
          name: profileData.full_name,
          role: profileData.roles?.name,
          status: profileData.status
        });
        setProfile(profileData);
      } else {
        console.log('⚠️ No profile data returned for user');
        setProfile(null);
      }
    } catch (error) {
      console.error('💥 Error in loadUserProfile:', error);
      // On any error, set profile to null to prevent infinite loading
      setProfile(null);
    }
  };

  // Setup session refresh monitoring
  const setupSessionRefresh = () => {
    // Check session every 30 minutes
    const checkInterval = 30 * 60 * 1000; // 30 minutes
    
    const checkSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session check error:', error);
          return;
        }
        
        if (currentSession) {
          // Check if session needs refresh (expires in less than 60 minutes)
          const expiresAt = currentSession.expires_at;
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = expiresAt - now;
          
          if (timeUntilExpiry < 3600) { // Less than 60 minutes
            console.log('Session expiring soon, refreshing...');
            await supabase.auth.refreshSession();
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
      
      // Schedule next check
      sessionRefreshTimeoutRef.current = setTimeout(checkSession, checkInterval);
    };
    
    // Start checking
    sessionRefreshTimeoutRef.current = setTimeout(checkSession, checkInterval);
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await auth.signIn(email, password);
      // Don't manually set loading to false here - let the auth state change handle it
      return { data, error };
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false); // Only set loading false on error
      return { data: null, error };
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
