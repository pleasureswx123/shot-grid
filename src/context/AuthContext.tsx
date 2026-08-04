import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, UserRole } from '../types';

interface SessionUserPayload {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar: string | null;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const createFallbackAvatar = (name: string): string => {
  const initial = (Array.from(name.trim())[0] || 'U')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
      <rect width="128" height="128" rx="24" fill="#4f46e5"/>
      <text x="64" y="78" text-anchor="middle" font-size="58"
            font-family="sans-serif" font-weight="700" fill="white">${initial}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const mapSessionUser = (user: SessionUserPayload): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  avatar: user.avatar || createFallbackAvatar(user.name),
});

const readError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // The server may return an empty or non-JSON error response.
  }
  return `请求失败（${response.status}）`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/auth/me', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setUser(null);
          return;
        }
        if (!response.ok) throw new Error(await readError(response));
        const body = await response.json();
        setUser(mapSessionUser(body.user));
      })
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError') {
          setError(requestError instanceof Error ? requestError.message : '无法连接服务器。');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json();
      setUser(mapSessionUser(body.user));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '无法连接服务器。';
      setError(message);
      throw requestError;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
