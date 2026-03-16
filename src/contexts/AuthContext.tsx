import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authEnabled: boolean;
  user: User | null;
  isAdmin: boolean;
  backendError: string | null;
  login: (email: string, password: string) => Promise<{ requires2fa: boolean; tempToken?: string }>;
  verify2fa: (tempToken: string, code: string, trustDevice?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await authApi.verify();
        setBackendError(null);
        setAuthEnabled(result.data.auth_enabled);
        if (!result.data.auth_enabled) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(result.data.token_valid);
          if (result.data.token_valid && result.data.user) {
            setUser(result.data.user);
          } else {
            localStorage.removeItem('auth_token');
          }
        }
      } catch (error) {
        localStorage.removeItem('auth_token');
        setUser(null);
        setIsAuthenticated(false);
        setBackendError(
          error instanceof Error && error.message
            ? error.message
            : 'Unable to connect to the backend database. Please verify your backend and database settings.'
        );
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const deviceToken = localStorage.getItem('device_token') || undefined;
    const result = await authApi.login(email, password, deviceToken);
    setBackendError(null);
    if (result.data.requires_2fa && result.data.temp_token) {
      return { requires2fa: true, tempToken: result.data.temp_token };
    }
    localStorage.setItem('auth_token', result.data.token!);
    setUser(result.data.user!);
    setIsAuthenticated(true);
    setAuthEnabled(true);
    return { requires2fa: false };
  }, []);

  const verify2fa = useCallback(async (tempToken: string, code: string) => {
    const result = await authApi.verify2fa(tempToken, code);
    setBackendError(null);
    localStorage.setItem('auth_token', result.data.token);
    setUser(result.data.user);
    setIsAuthenticated(true);
    setAuthEnabled(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, authEnabled, user, isAdmin, backendError, login, verify2fa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
