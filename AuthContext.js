import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from './supabase';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        logWithTime('🔍 Checking for existing session...');
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          logWithTime('❌ Error getting session:', error);
          throw error;
        }

        if (currentSession) {
          logWithTime('✅ Found existing session for:', currentSession.user.email);
          setSession(currentSession);
          setUser(currentSession.user);
        } else {
          logWithTime('ℹ️  No existing session found');
        }
      } catch (error) {
        logWithTime('❌ Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        logWithTime('🔐 Auth state changed:', event);

        if (currentSession) {
          logWithTime('✅ Session active for:', currentSession.user.email);
          setSession(currentSession);
          setUser(currentSession.user);
        } else {
          logWithTime('ℹ️  Session ended');
          setSession(null);
          setUser(null);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      logWithTime('👋 Signing out...');
      const { error } = await supabase.auth.signOut();

      if (error) {
        logWithTime('❌ Sign out error:', error);
        throw error;
      }

      logWithTime('✅ Signed out successfully');
      setSession(null);
      setUser(null);
    } catch (error) {
      logWithTime('❌ Error during sign out:', error);
      throw error;
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
