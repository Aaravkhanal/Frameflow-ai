import { create } from "zustand";
import { HTTP_BACKEND_URL } from "../config";

export interface User {
  id: number;
  email: string;
  name: string;
  is_verified: boolean;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalTab: "login" | "signup" | "forgot";
  isLoading: boolean;

  setAuthModalOpen: (open: boolean, tab?: "login" | "signup" | "forgot") => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, name: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
  sendOtp: (email: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>;
}

const TOKEN_KEY = "frameflow_auth_token";

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: false,
  isAuthModalOpen: false,
  authModalTab: "login",
  isLoading: true,

  setAuthModalOpen: (open: boolean, tab = "login") => {
    set({ isAuthModalOpen: open, authModalTab: tab });
  },

  checkAuth: async () => {
    const token = get().token || localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const res = await fetch(`${HTTP_BACKEND_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const user = await res.json();
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    try {
      const res = await fetch(`${HTTP_BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.detail || "Invalid login credentials." };
      }

      localStorage.setItem(TOKEN_KEY, data.access_token);
      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
        isAuthModalOpen: false,
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, error: "Network error occurred during sign in." };
    }
  },

  register: async (email: string, name: string, password: string) => {
    try {
      const res = await fetch(`${HTTP_BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.detail || "Registration failed." };
      }

      localStorage.setItem(TOKEN_KEY, data.access_token);
      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
        isAuthModalOpen: false,
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, error: "Network error occurred during registration." };
    }
  },

  forgotPassword: async (email: string) => {
    try {
      const res = await fetch(`${HTTP_BACKEND_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      return { ok: true, message: data.message };
    } catch (err) {
      return { ok: false, error: "Error sending password reset request." };
    }
  },

  logout: async () => {
    try {
      await fetch(`${HTTP_BACKEND_URL}/api/auth/logout`, { method: "POST" });
    } catch {
      // Ignore network failure during logout
    }
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },

  sendOtp: async (email: string) => {
    try {
      const res = await fetch(`${HTTP_BACKEND_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.detail || "Failed to send OTP." };
      }
      return { ok: true, message: data.message };
    } catch (err) {
      return { ok: false, error: "Network error occurred." };
    }
  },

  verifyOtp: async (email: string, token: string) => {
    try {
      const res = await fetch(`${HTTP_BACKEND_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.detail || "Invalid or expired OTP." };
      }

      localStorage.setItem(TOKEN_KEY, data.access_token);
      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
        isAuthModalOpen: false,
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, error: "Network error occurred." };
    }
  },
}));
