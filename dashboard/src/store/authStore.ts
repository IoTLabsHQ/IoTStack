import { create } from "zustand";

export interface Admin {
  id: number;
  email: string;
}

interface AuthState {
  token: string | null;
  admin: Admin | null;
  setAuth: (token: string, admin: Admin) => void;
  clear: () => void;
}

const STORAGE_KEY = "iotstack_session";

function loadStored(): { token: string | null; admin: Admin | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, admin: null };
    return JSON.parse(raw);
  } catch {
    return { token: null, admin: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadStored(),
  setAuth: (token, admin) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin }));
    } catch {
      // sessionStorage unavailable — session just won't survive a reload
    }
    set({ token, admin });
  },
  clear: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ token: null, admin: null });
  },
}));
