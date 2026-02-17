
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { User, UserRole, LoginCredentials } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiresAt: Date | null;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  loginAsGuest: (role: UserRole) => void;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  checkSession: () => boolean;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    sessionExpiresAt: null,
  });

  const getPermissionsForRole = (role: UserRole): string[] => {
    switch (role) {
      case UserRole.ADMIN:
        return ['can_delete', 'can_edit_stock', 'can_roast', 'can_sell', 'can_view_reports'];
      case UserRole.MANAGER:
        return ['can_edit_stock', 'can_roast', 'can_sell', 'can_view_reports'];
      case UserRole.HR:
        return ['can_view_reports'];
      case UserRole.ROASTER:
        return ['can_roast', 'can_edit_stock'];
      case UserRole.CASHIER:
        return ['can_sell', 'can_view_reports'];
      case UserRole.WAREHOUSE_STAFF:
        return ['can_edit_stock'];
      default:
        return [];
    }
  };

  const fetchUserProfile = async (userId: string, email: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return {
          id: userId,
          email: email,
          name: email.split('@')[0],
          role: UserRole.ADMIN,
          permissions: getPermissionsForRole(UserRole.ADMIN),
        };
      }

      if (data.is_active === false) return null;

      return {
        id: data.id,
        email: email,
        name: data.full_name || data.username || email.split('@')[0],
        role: (data.role as UserRole) || UserRole.CASHIER,
        permissions: data.permissions || getPermissionsForRole((data.role as UserRole) || UserRole.CASHIER),
        avatar: data.avatar_url,
      };
    } catch (e) {
      console.error("Profile fetch error:", e);
      return null;
    }
  };

  const updateAuthStateFromSession = useCallback(async (session: any) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      if (session) {
        const profile = await fetchUserProfile(session.user.id, session.user.email);
        if (profile) {
          setState({
            user: profile,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            sessionExpiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
          });
        } else {
          await supabase.auth.signOut();
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: "Account disabled",
            sessionExpiresAt: null,
          });
        }
      } else {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          sessionExpiresAt: null,
        });
      }
    } catch (err) {
      console.error("Auth sync error:", err);
      setState(prev => ({ ...prev, isLoading: false, isAuthenticated: false }));
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('demo_mode') === 'true') {
      localStorage.removeItem('demo_mode');
      localStorage.removeItem('demo_role');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthStateFromSession(session);
    }).catch(() => {
      setState(prev => ({ ...prev, isLoading: false }));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        localStorage.removeItem('demo_mode');
        localStorage.removeItem('demo_role');
      }
      updateAuthStateFromSession(session);
    });

    return () => subscription.unsubscribe();
  }, [updateAuthStateFromSession]);

  const login = async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const email = credentials.identifier.includes('@') 
        ? credentials.identifier 
        : `${credentials.identifier}@roastery.com`;

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: credentials.password,
      });

      if (error) throw error;
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false, error: err.message }));
      throw err;
    }
  };

  const loginAsGuest = () => {
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('demo_role');
    setState(prev => ({
      ...prev,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: 'Demo disabled',
      sessionExpiresAt: null,
    }));
  };

  const logout = async () => {
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('demo_role');
    setState(prev => ({ ...prev, isLoading: true }));
    await supabase.auth.signOut();
  };

  const forgotPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const resetPassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const refreshSession = async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    await updateAuthStateFromSession(session);
  };

  const checkSession = () => {
    if (!state.sessionExpiresAt) return false;
    return new Date() < state.sessionExpiresAt;
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!state.user || state.user.id === 'demo-user') return;
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: data.name,
        avatar_url: data.avatar,
      })
      .eq('id', state.user.id);

    if (error) throw error;
    
    const updatedProfile = await fetchUserProfile(state.user.id, state.user.email);
    if (updatedProfile) setState(prev => ({ ...prev, user: updatedProfile }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginAsGuest,
        logout,
        forgotPassword,
        resetPassword,
        changePassword,
        refreshSession,
        checkSession,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
