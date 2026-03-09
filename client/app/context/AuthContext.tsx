"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email: string;
  planId: string;
  planExpiresAt: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: (authToken?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://server.fahadakash.com/penta';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async (authToken?: string) => {
    const activeToken = authToken || localStorage.getItem("token");
    if (!activeToken) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
      }
    } catch (e) {
      console.error("Failed to refresh user:", e);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      // Refresh to get latest plan status
      refreshUser(savedToken);
    }
    setIsLoading(false);
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403 && data.reason) {
        throw new Error(`RESTRICTED: ${data.reason}`);
      }
      throw new Error(data.error || "Login failed");
    }
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    // If the backend returns a token (e.g. if verification is disabled or for some other reason), set it.
    // Otherwise, the calling page (RegisterPage) will handle the next step (e.g. redirect to OTP)
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
