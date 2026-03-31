import type { Router } from "vue-router";
import axios from "axios";
import { defineStore } from "pinia";

// ===== Types =====
interface AuthData {
  accessToken: string;
  refreshToken: string;
  username: string;
  lastActiveAt: number;
}

const STORAGE_KEY = "auth";
const BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://192.168.0.250:8000";

const authClient = axios.create({ baseURL: BASE_URL });

function decodeJwt(token?: string) {
  try {
    if (!token) return null;
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ===== localStorage helpers =====
function loadFromStorage(): AuthData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        accessToken: parsed.accessToken || "",
        refreshToken: parsed.refreshToken || "",
        username: parsed.username || "",
        lastActiveAt: parsed.lastActiveAt || 0,
      };
    }
  } catch { /* corrupto ou indisponível */ }
  return { accessToken: "", refreshToken: "", username: "", lastActiveAt: 0 };
}

function saveToStorage(data: AuthData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* */ }
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* */ }
}

// ===== Constants =====
const REFRESH_SAFETY_WINDOW_MS = 30_000;
const IDLE_MAX_MS = 24 * 60 * 60 * 1000;

export const useAuthStore = defineStore("auth", {
  // State inicializa direto do localStorage
  state: () => {
    const stored = loadFromStorage();
    return {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      username: stored.username,
      lastActiveAt: stored.lastActiveAt,
      _refreshTimer: 0 as unknown as number,
      _refreshPromise: null as Promise<void> | null,
      initialized: false,
    };
  },

  getters: {
    isAuthenticated: (s) => !!s.accessToken,
  },

  actions: {
    // Persiste estado atual no localStorage
    _persist() {
      saveToStorage({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        username: this.username,
        lastActiveAt: this.lastActiveAt,
      });
    },

    _scheduleRefresh() {
      clearTimeout(this._refreshTimer as number);
      const payload = decodeJwt(this.accessToken);
      if (!payload?.exp) return;
      const delay = Math.max(0, payload.exp * 1000 - Date.now() - REFRESH_SAFETY_WINDOW_MS);
      this._refreshTimer = setTimeout(() => {
        this.refresh().catch(() => {});
      }, delay) as unknown as number;
    },

    touchActivity() {
      this.lastActiveAt = Date.now();
      this._persist();
    },

    async bootstrap() {
      try {
        // Relê do localStorage (fonte da verdade)
        const stored = loadFromStorage();
        this.accessToken = stored.accessToken;
        this.refreshToken = stored.refreshToken;
        this.username = stored.username;
        this.lastActiveAt = stored.lastActiveAt;

        if (!this.accessToken && !this.refreshToken) return;

        // Inatividade > 24h
        if (this.lastActiveAt && Date.now() - this.lastActiveAt > IDLE_MAX_MS) {
          this._clearSession();
          return;
        }

        // Valida token no servidor
        if (this.accessToken) {
          try {
            await authClient.get("/api/auth/me/", {
              headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            this._scheduleRefresh();
          } catch {
            if (this.refreshToken) {
              try {
                await this.refresh();
                this._scheduleRefresh();
              } catch {
                this._clearSession();
                return;
              }
            } else {
              this._clearSession();
              return;
            }
          }
        } else if (this.refreshToken) {
          try {
            await this.refresh();
            this._scheduleRefresh();
          } catch {
            this._clearSession();
            return;
          }
        }

        // Listeners de atividade
        const onActivity = () => this.touchActivity();
        window.addEventListener("click", onActivity);
        window.addEventListener("keydown", onActivity);
        window.addEventListener("mousemove", onActivity);
        window.addEventListener("scroll", onActivity);
        if (!this.lastActiveAt) this.touchActivity();
      } finally {
        this.initialized = true;
      }
    },

    async login(username: string, password: string) {
      const { data } = await authClient.post<{
        accessToken?: string;
        refreshToken?: string;
        access?: string;
        refresh?: string;
      }>("/api/auth/login/", { username, password });

      const accessToken = data?.accessToken || data?.access;
      const refreshToken = data?.refreshToken || data?.refresh;

      if (!accessToken || !refreshToken) {
        throw new Error("Resposta da API inválida: tokens não encontrados");
      }

      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.username = username;
      this.touchActivity();
      this._scheduleRefresh();
    },

    async refresh() {
      if (this._refreshPromise) return this._refreshPromise;
      if (!this.refreshToken) throw new Error("Sem refresh token");

      this._refreshPromise = (async () => {
        const { data } = await authClient.post<{ accessToken?: string; access?: string }>(
          "/api/auth/refresh/",
          { refresh: this.refreshToken },
        );
        const accessToken = data?.accessToken || data?.access;
        if (!accessToken) throw new Error("Resposta inválida no refresh");
        this.accessToken = accessToken;
        this._persist();
        this._scheduleRefresh();
      })();

      try {
        await this._refreshPromise;
      } finally {
        this._refreshPromise = null;
      }
    },

    _clearSession() {
      clearTimeout(this._refreshTimer as number);
      this._refreshPromise = null;
      this.accessToken = "";
      this.refreshToken = "";
      this.username = "";
      this.lastActiveAt = 0;
      clearStorage();
    },

    async logout(router?: Router) {
      this._clearSession();
      if (router) {
        await router.replace({ name: "login" });
      }
    },
  },
});
