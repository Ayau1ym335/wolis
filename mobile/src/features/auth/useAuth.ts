/**
 * features/auth/useAuth.ts
 *
 * TASK 36 — Supabase authentication for the mobile app.
 *
 * Architecture:
 *   - AuthStore  : singleton that holds the session in memory + AsyncStorage
 *   - useAuth()  : React hook that subscribes to the store
 *   - signIn()   : email/password → Supabase Auth REST → stores access_token
 *   - signOut()  : clears token everywhere (memory + storage + apiClient)
 *
 * On boot: restores persisted session and re-attaches token to apiClient.
 *
 * The access_token is automatically attached to ALL subsequent API requests
 * via setAuthToken() — apiClient reads it on every call through a closure.
 * No higher-order-component or context provider wrapping needed.
 */

import { useEffect, useState } from "react";
import { setAuthToken } from "../../services/apiClient";
import { env } from "../../config/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WolisSession {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string | null;
  expires_at: number; // Unix timestamp (seconds)
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AuthState {
  status: AuthStatus;
  session: WolisSession | null;
  error: string | null;
}

// ─── Persistence layer (AsyncStorage polyfill for non-RN environments) ────────
// In a real Expo/RN project replace this with:
//   import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@wolis/session";

const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      // React Native: AsyncStorage.getItem(key)
      if (typeof globalThis !== "undefined" && (globalThis as any).AsyncStorage) {
        return (globalThis as any).AsyncStorage.getItem(key);
      }
      // Web / Jest fallback
      return (typeof localStorage !== "undefined" ? localStorage.getItem(key) : null);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof globalThis !== "undefined" && (globalThis as any).AsyncStorage) {
        return (globalThis as any).AsyncStorage.setItem(key, value);
      }
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    } catch {}
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (typeof globalThis !== "undefined" && (globalThis as any).AsyncStorage) {
        return (globalThis as any).AsyncStorage.removeItem(key);
      }
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    } catch {}
  },
};

// ─── Supabase Auth REST helpers ───────────────────────────────────────────────

interface SupabaseTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string | null };
}

async function supabaseSignIn(email: string, password: string): Promise<WolisSession> {
  const url = `${env.SUPABASE_URL}/auth/v1/token?grant_type=password`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": env.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Сеть недоступна. Проверьте подключение к интернету.");
  }

  if (!res.ok) {
    let msg = "Ошибка входа. Проверьте email и пароль.";
    try {
      const body = await res.json();
      if (body?.error_description) msg = body.error_description;
      else if (body?.msg) msg = body.msg;
    } catch {}
    throw new Error(msg);
  }

  const data: SupabaseTokenResponse = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user.id,
    email: data.user.email ?? null,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

async function supabaseRefresh(refresh_token: string): Promise<WolisSession> {
  const url = `${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token }),
  });

  if (!res.ok) throw new Error("Session expired. Please sign in again.");

  const data: SupabaseTokenResponse = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user.id,
    email: data.user.email ?? null,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

// ─── Auth Store (singleton) ───────────────────────────────────────────────────

type Listener = (state: AuthState) => void;

class AuthStore {
  private state: AuthState = { status: "loading", session: null, error: null };
  private listeners = new Set<Listener>();

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<AuthState>): void {
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l(this.state);
  }

  /** Called once on app boot — restores persisted session. */
  async initialize(): Promise<void> {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (!raw) {
        this.setState({ status: "unauthenticated" });
        return;
      }

      const session: WolisSession = JSON.parse(raw);

      // Proactively refresh if within 5 minutes of expiry
      const nowSec = Math.floor(Date.now() / 1000);
      if (session.expires_at - nowSec < 300) {
        try {
          const refreshed = await supabaseRefresh(session.refresh_token);
          await this._persist(refreshed);
          return;
        } catch {
          await storage.removeItem(STORAGE_KEY);
          this.setState({ status: "unauthenticated" });
          return;
        }
      }

      await this._attach(session);
    } catch {
      this.setState({ status: "unauthenticated" });
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.setState({ status: "loading", error: null });
    try {
      const session = await supabaseSignIn(email, password);
      await this._persist(session);
    } catch (e) {
      this.setState({ status: "error", error: (e as Error).message });
    }
  }

  async signOut(): Promise<void> {
    await storage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    this.setState({ status: "unauthenticated", session: null, error: null });
  }

  /**
   * Proactively refreshes the access token using the stored refresh_token.
   * Call this before making an important API request if the token might be expired.
   * Returns true if refresh succeeded, false otherwise (and signs the user out).
   */
  async refreshSession(): Promise<boolean> {
    const session = this.state.session;
    if (!session?.refresh_token) {
      await this.signOut();
      return false;
    }
    try {
      const refreshed = await supabaseRefresh(session.refresh_token);
      await this._persist(refreshed);
      return true;
    } catch {
      await this.signOut();
      return false;
    }
  }

  private async _persist(session: WolisSession): Promise<void> {
    await storage.setItem(STORAGE_KEY, JSON.stringify(session));
    await this._attach(session);
  }

  private async _attach(session: WolisSession): Promise<void> {
    setAuthToken(session.access_token);
    this.setState({ status: "authenticated", session, error: null });
  }
}

// Singleton — one store for the whole app lifetime
const authStore = new AuthStore();

/** Must be called once in your app's root component (e.g. App.tsx or WolisNavigator). */
export function initializeAuth(): Promise<void> {
  return authStore.initialize();
}

// ─── React hook ───────────────────────────────────────────────────────────────

export interface UseAuthResult extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Refresh the access token. Returns true on success, false if session ended. */
  refreshSession: () => Promise<boolean>;
}

export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>(authStore.getState());

  useEffect(() => {
    // Re-sync in case store was updated before mount
    setState(authStore.getState());
    return authStore.subscribe(setState);
  }, []);

  return {
    ...state,
    signIn: (email, password) => authStore.signIn(email, password),
    signOut: () => authStore.signOut(),
    refreshSession: () => authStore.refreshSession(),
  };
}
