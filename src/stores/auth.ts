import type { Router } from "vue-router";
import axios from "axios";
import { defineStore } from "pinia";

// ===== Types =====
interface UserSnapshot {
  id: number;
  username: string;
  nome_completo: string;
  email: string;
  avatar: string | null;
  is_admin: boolean;
  is_active: boolean;
  permissao: number | null;
  permissao_nome: string | null;
}

interface AuthData {
  accessToken: string;
  refreshToken: string;
  username: string;
  lastActiveAt: number;
  capacidades: string[];
  user: UserSnapshot | null;
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

function emptyUser(): UserSnapshot | null {
  return null;
}

function normalizeUser(raw: any): UserSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: Number(raw.id),
    username: String(raw.username || ""),
    nome_completo: String(raw.nome_completo || ""),
    email: String(raw.email || ""),
    avatar: raw.avatar || null,
    is_admin: !!raw.is_admin,
    is_active: !!raw.is_active,
    permissao: raw.permissao ?? null,
    permissao_nome: raw.permissao_detalhe?.nome ?? null,
  };
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
        capacidades: Array.isArray(parsed.capacidades) ? parsed.capacidades : [],
        user: parsed.user || emptyUser(),
      };
    }
  } catch { /* corrupto ou indisponível */ }
  return {
    accessToken: "", refreshToken: "", username: "", lastActiveAt: 0,
    capacidades: [], user: emptyUser(),
  };
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
  state: () => {
    const stored = loadFromStorage();
    return {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      username: stored.username,
      lastActiveAt: stored.lastActiveAt,
      capacidades: stored.capacidades,
      user: stored.user as UserSnapshot | null,
      _refreshTimer: 0 as unknown as number,
      _refreshPromise: null as Promise<void> | null,
      initialized: false,
    };
  },

  getters: {
    isAuthenticated: (s) => !!s.accessToken,
    isAdmin: (s) => {
      if (s.user?.is_admin) return true;
      const payload = decodeJwt(s.accessToken);
      return !!payload?.is_admin;
    },
    avatarUrl: (s) => s.user?.avatar || null,
    permissaoNome: (s) => s.user?.permissao_nome || null,
  },

  actions: {
    _persist() {
      saveToStorage({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        username: this.username,
        lastActiveAt: this.lastActiveAt,
        capacidades: this.capacidades,
        user: this.user,
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

    can(codigo: string): boolean {
      if (this.isAdmin) return true;
      return this.capacidades.includes(codigo);
    },

    _applyUserPayload(raw: any) {
      const snap = normalizeUser(raw);
      this.user = snap;
      if (snap?.username) this.username = snap.username;
      const caps = Array.isArray(raw?.capacidades) ? raw.capacidades : [];
      this.capacidades = caps;
      this._persist();
    },

    async fetchMe() {
      if (!this.accessToken) return;
      try {
        const { data } = await authClient.get("/api/auth/me/", {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        this._applyUserPayload(data);
      } catch {
        /* silencioso — tratamento em bootstrap */
      }
    },

    async bootstrap() {
      try {
        const stored = loadFromStorage();
        this.accessToken = stored.accessToken;
        this.refreshToken = stored.refreshToken;
        this.username = stored.username;
        this.lastActiveAt = stored.lastActiveAt;
        this.capacidades = stored.capacidades;
        this.user = stored.user;

        if (!this.accessToken && !this.refreshToken) return;

        if (this.lastActiveAt && Date.now() - this.lastActiveAt > IDLE_MAX_MS) {
          this._clearSession();
          return;
        }

        if (this.accessToken) {
          try {
            await this.fetchMe();
            this._scheduleRefresh();
          } catch {
            if (this.refreshToken) {
              try {
                await this.refresh();
                await this.fetchMe();
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
            await this.fetchMe();
            this._scheduleRefresh();
          } catch {
            this._clearSession();
            return;
          }
        }

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
        user?: any;
      }>("/api/auth/login/", { username, password });

      const accessToken = data?.accessToken || data?.access;
      const refreshToken = data?.refreshToken || data?.refresh;

      if (!accessToken || !refreshToken) {
        throw new Error("Resposta da API inválida: tokens não encontrados");
      }

      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.username = username;

      if (data?.user) {
        this._applyUserPayload(data.user);
      }

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

    /** Alias usado pelo api.ts: refresca proativamente se faltar menos que a janela. */
    async refreshIfNeeded() {
      if (!this.accessToken || !this.refreshToken) return;
      const payload = decodeJwt(this.accessToken);
      if (!payload?.exp) return;
      const ms = payload.exp * 1000 - Date.now();
      if (ms <= REFRESH_SAFETY_WINDOW_MS) {
        await this.refresh();
      }
    },

    _clearSession() {
      clearTimeout(this._refreshTimer as number);
      this._refreshPromise = null;
      this.accessToken = "";
      this.refreshToken = "";
      this.username = "";
      this.lastActiveAt = 0;
      this.capacidades = [];
      this.user = null;
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
