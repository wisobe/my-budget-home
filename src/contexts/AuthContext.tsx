import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '@/lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  authEnabled: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await authApi.verify();
        setAuthEnabled(result.data.auth_enabled);
        if (!result.data.auth_enabled) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(result.data.token_valid);
          if (!result.data.token_valid) {
            sessionStorage.removeItem('auth_token');
          }
        }
      } catch {
        // API not reachable — allow access (first-time setup)
        setIsAuthenticated(true);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(async (password: string) => {
    const result = await authApi.login(password);
    sessionStorage.setItem('auth_token', result.data.token);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, authEnabled, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
