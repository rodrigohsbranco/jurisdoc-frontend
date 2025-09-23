import axios from "axios";
import { defineStore } from "pinia";
const BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://192.168.0.250:8000";
// axios “limpo” (sem interceptors globais) p/ login/refresh
const authClient = axios.create({ baseURL: BASE_URL });
// util: decodifica o payload do JWT (sem validar assinatura)
function decodeJwt(token) {
  try {
    if (!token) {
      return null;
    }
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
const REFRESH_SAFETY_WINDOW_MS = 30000; // tenta refresh 30s antes de expirar
const IDLE_MAX_MS = 24 * 60 * 60 * 1000; // 24h
export const useAuthStore = defineStore("auth", {
  state: () => ({
    accessToken: "",
    refreshToken: "",
    username: "",
    lastActiveAt: 0,
    _refreshTimer: 0,
    _refreshPromise: null,
    initialized: false, // <- flag para o router saber quando pode decidir
  }),
  // Persistência (pinia-plugin-persistedstate)
  // Dica: se seu projeto não tiver a tipagem do plugin, o "as any" evita ruído de TS
  persist: {
    storage: localStorage,
    paths: ["accessToken", "refreshToken", "username", "lastActiveAt"],
  },
  getters: {
    isAuthenticated: (s) => !!s.accessToken,
  },
  actions: {
    _scheduleRefresh() {
      clearTimeout(this._refreshTimer);
      const payload = decodeJwt(this.accessToken);
      if (!payload?.exp) {
        return;
      }
      const expMs = payload.exp * 1000;
      const now = Date.now();
      const delay = Math.max(0, expMs - now - REFRESH_SAFETY_WINDOW_MS);
      this._refreshTimer = setTimeout(() => {
        this.refresh().catch(() => {});
      }, delay);
    },
    touchActivity() {
      this.lastActiveAt = Date.now();
    },
    async bootstrap() {
      try {
        // corta sessão se inativo por > 24h
        if (this.lastActiveAt && Date.now() - this.lastActiveAt > IDLE_MAX_MS) {
          await this.logout();
          return;
        }
        // tenta renovar access se necessário
        if (this.refreshToken) {
          try {
            await this.refreshIfNeeded();
          } catch {
            // silencioso: o interceptor lidará com 401 depois
          }
        }
        this._scheduleRefresh();
        // listeners de atividade (para resetar o relógio de 24h)
        const onActivity = () => this.touchActivity();
        window.addEventListener("click", onActivity);
        window.addEventListener("keydown", onActivity);
        window.addEventListener("mousemove", onActivity);
        window.addEventListener("scroll", onActivity);
        if (!this.lastActiveAt) {
          this.touchActivity();
        }
      } finally {
        // muito importante: sinalizar que terminou, mesmo se deslogar
        this.initialized = true;
      }
    },
    async login(username, password) {
      const { data } = await authClient.post("/api/auth/login/", {
        username,
        password,
      });
      this.accessToken = data.access;
      this.refreshToken = data.refresh;
      this.username = username;
      this.touchActivity();
      this._scheduleRefresh();
    },
    async refreshIfNeeded() {
      const p = decodeJwt(this.accessToken);
      const now = Date.now();
      if (!p?.exp) {
        // sem access válido -> tenta com refresh
        return this.refresh();
      }
      const msToExp = p.exp * 1000 - now;
      if (msToExp <= REFRESH_SAFETY_WINDOW_MS) {
        return this.refresh();
      }
      // não precisa refrescar
    },
    async refresh() {
      if (this._refreshPromise) {
        return this._refreshPromise;
      }
      if (!this.refreshToken) {
        throw new Error("Sem refresh token");
      }
      this._refreshPromise = (async () => {
        const { data } = await authClient.post("/api/auth/refresh/", {
          refresh: this.refreshToken,
        });
        this.accessToken = data.access;
        this._scheduleRefresh();
      })();
      try {
        await this._refreshPromise;
      } finally {
        this._refreshPromise = null;
      }
    },
    async logout(router) {
      this.accessToken = "";
      this.refreshToken = "";
      this.username = "";
      this.lastActiveAt = 0;
      clearTimeout(this._refreshTimer);
      if (router) {
        router.replace({ name: "login" });
      }
      // não zera 'initialized'; app já está inicializada, só sem sessão
    },
  },
});
