import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { UserProfile, UserRole } from '../../shared/types';
import { api } from '../lib/api';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    institutionName?: string;
    cluesCode?: string;
    medicalLicense?: string;
    specialty?: string;
    phone?: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await api.getMe();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedIn } = await api.login(email, password);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      fullName: string;
      role: UserRole;
      institutionName?: string;
      cluesCode?: string;
      medicalLicense?: string;
      specialty?: string;
      phone?: string;
    }) => {
      const { user: created } = await api.register(payload);
      setUser(created);
      return created;
    },
    []
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
