import type { Router } from "vue-router";
import axios from "axios";
import { defineStore } from "pinia";

// ===== Types =====
type Tokens = { accessToken: string; refreshToken: string };

const BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://192.168.0.250:8000";

// axios “limpo” (sem interceptors globais) p/ login/refresh
const authClient = axios.create({ baseURL: BASE_URL });

// util: decodifica o payload do JWT (sem validar assinatura)
function decodeJwt(token?: string) {
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

const REFRESH_SAFETY_WINDOW_MS = 30_000; // tenta refresh 30s antes de expirar
const IDLE_MAX_MS = 24 * 60 * 60 * 1000; // 24h

export const useAuthStore = defineStore("auth", {
  state: () => ({
    accessToken: "" as string,
    refreshToken: "" as string,
    username: "" as string,
    lastActiveAt: 0 as number,
    _refreshTimer: 0 as unknown as number,
    _refreshPromise: null as Promise<void> | null,
    initialized: false, // <- flag para o router saber quando pode decidir
  }),

  // Persistência (pinia-plugin-persistedstate)
  // Dica: se seu projeto não tiver a tipagem do plugin, o "as any" evita ruído de TS
  persist: {
    key: 'auth',
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    paths: ["accessToken", "refreshToken", "username", "lastActiveAt"],
    // Garante que valores vazios não sejam salvos
    serializer: {
      deserialize: JSON.parse,
      serialize: JSON.stringify,
    },
  } as any,

  getters: {
    isAuthenticated: (s) => !!s.accessToken,
  },

  actions: {
    _scheduleRefresh() {
      clearTimeout(this._refreshTimer as number);
      const payload = decodeJwt(this.accessToken);
      if (!payload?.exp) {
        return;
      }
      const expMs = payload.exp * 1000;
      const now = Date.now();
      const delay = Math.max(0, expMs - now - REFRESH_SAFETY_WINDOW_MS);
      this._refreshTimer = setTimeout(() => {
        this.refresh().catch(() => {});
      }, delay) as unknown as number;
    },

    touchActivity() {
      this.lastActiveAt = Date.now();
      // Atualiza o lastActiveAt no localStorage também
      try {
        const stored = localStorage.getItem('auth');
        const currentData = stored ? JSON.parse(stored) : {};
        currentData.lastActiveAt = this.lastActiveAt;
        localStorage.setItem('auth', JSON.stringify(currentData));
      } catch (e) {
        // Ignora erros de localStorage
      }
    },

    async bootstrap() {
      try {
        // Verifica diretamente no localStorage se há tokens salvos
        // O pinia-plugin-persistedstate usa a chave 'auth' (definida acima)
        let storedData: any = null;
        try {
          const stored = localStorage.getItem('auth');
          if (stored) {
            storedData = JSON.parse(stored);
          }
        } catch {
          // localStorage pode estar vazio ou corrompido
        }

        // Se não há tokens no localStorage E no estado atual, não precisa validar
        const hasAccessToken = storedData?.accessToken || this.accessToken;
        const hasRefreshToken = storedData?.refreshToken || this.refreshToken;
        const lastActive = storedData?.lastActiveAt || this.lastActiveAt;

        if (!hasAccessToken && !hasRefreshToken) {
          this.initialized = true;
          return;
        }

        // Restaura valores do localStorage se o plugin ainda não restaurou
        if (storedData) {
          if (storedData.accessToken && !this.accessToken) {
            this.accessToken = storedData.accessToken;
          }
          if (storedData.refreshToken && !this.refreshToken) {
            this.refreshToken = storedData.refreshToken;
          }
          if (storedData.username && !this.username) {
            this.username = storedData.username;
          }
          if (storedData.lastActiveAt && !this.lastActiveAt) {
            this.lastActiveAt = storedData.lastActiveAt;
          }
        }

        // corta sessão se inativo por > 24h
        if (lastActive && Date.now() - lastActive > IDLE_MAX_MS) {
          await this.logout();
          return;
        }

        // Valida o token atual fazendo uma chamada ao servidor
        if (this.accessToken) {
          try {
            // Verifica se o token ainda é válido no servidor
            await authClient.get("/api/auth/me/", {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
            });
            // Token válido, agenda refresh se necessário
            this._scheduleRefresh();
          } catch (error: any) {
            // Token inválido ou expirado, tenta fazer refresh
            if (this.refreshToken) {
              try {
                await this.refresh();
                // Após refresh bem-sucedido, valida novamente
                await authClient.get("/api/auth/me/", {
                  headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                  },
                });
                this._scheduleRefresh();
              } catch {
                // Refresh falhou, limpa a sessão
                await this.logout();
                return;
              }
            } else {
              // Sem refresh token, limpa a sessão
              await this.logout();
              return;
            }
          }
        } else if (this.refreshToken) {
          // Tem refresh token mas não tem access token, tenta renovar
          try {
            await this.refresh();
            // Após refresh, valida o novo token
            await authClient.get("/api/auth/me/", {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
            });
            this._scheduleRefresh();
          } catch {
            // Refresh falhou, limpa a sessão
            await this.logout();
            return;
          }
        }

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

    async login(username: string, password: string) {
      const { data } = await authClient.post<{ 
        accessToken?: string; 
        refreshToken?: string;
        access?: string;
        refresh?: string;
      }>("/api/auth/login/", {
        username,
        password,
      });
      
      // Aceita tanto accessToken/refreshToken quanto access/refresh (formato padrão JWT)
      const accessToken = data?.accessToken || data?.access;
      const refreshToken = data?.refreshToken || data?.refresh;
      
      // Valida que os tokens foram recebidos
      if (!accessToken || !refreshToken) {
        const errorMsg = 'Resposta da API inválida: tokens não encontrados';
        console.error(errorMsg, data);
        throw new Error(errorMsg);
      }
      
      // Atribui os valores - o plugin de persistência salvará automaticamente
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.username = username;
      this.touchActivity();
      
      // Função auxiliar para salvar no localStorage
      const saveToLocalStorage = () => {
        const dataToSave = {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          username: this.username,
          lastActiveAt: this.lastActiveAt,
        };
        
        // Verifica se localStorage está disponível
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
          throw new Error('localStorage não está disponível');
        }
        
        localStorage.setItem('auth', JSON.stringify(dataToSave));
        
        // Verifica se foi salvo corretamente
        const saved = localStorage.getItem('auth');
        if (!saved) {
          throw new Error('Falha ao salvar no localStorage: item não encontrado após salvamento');
        }
        
        const parsed = JSON.parse(saved);
        if (!parsed.accessToken || !parsed.refreshToken) {
          throw new Error('Dados salvos no localStorage estão incompletos');
        }
        
        return true;
      };
      
      // Tenta salvar imediatamente
      try {
        saveToLocalStorage();
        if (import.meta.env.DEV) {
          console.log('Login realizado com sucesso. Tokens salvos no localStorage.');
        }
      } catch (e: any) {
        const errorMsg = `Erro ao salvar no localStorage: ${e?.message || String(e)}`;
        console.error(errorMsg, e);
        
        // Tenta novamente após um pequeno delay (pode ser que o plugin precise de tempo)
        setTimeout(() => {
          try {
            saveToLocalStorage();
            console.log('Salvamento no localStorage bem-sucedido na segunda tentativa.');
          } catch (e2: any) {
            console.error('Falha ao salvar no localStorage mesmo na segunda tentativa:', e2);
            // Em produção, isso pode indicar um problema sério
            // Mas não vamos quebrar o fluxo - o usuário pode ainda estar autenticado na sessão atual
          }
        }, 100);
      }
      
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
        const { data } = await authClient.post<{ accessToken?: string; access?: string }>(
          "/api/auth/refresh/",
          { refresh: this.refreshToken }
        );
        // Aceita tanto accessToken quanto access (formato padrão JWT)
        const accessToken = data?.accessToken || data?.access;
        if (!accessToken) {
          throw new Error('Resposta da API inválida: accessToken não encontrado');
        }
        // Atualiza o accessToken - o plugin de persistência salvará automaticamente
        this.accessToken = accessToken;
        
        // Força o salvamento no localStorage
        try {
          const stored = localStorage.getItem('auth');
          const currentData = stored ? JSON.parse(stored) : {};
          currentData.accessToken = this.accessToken;
          localStorage.setItem('auth', JSON.stringify(currentData));
        } catch (e) {
          console.warn('Erro ao salvar refresh no localStorage:', e);
        }
        
        this._scheduleRefresh();
      })();

      try {
        await this._refreshPromise;
      } finally {
        this._refreshPromise = null;
      }
    },

    async logout(router?: Router) {
      this.accessToken = "";
      this.refreshToken = "";
      this.username = "";
      this.lastActiveAt = 0;
      clearTimeout(this._refreshTimer as number);
      if (router) {
        router.replace({ name: "login" });
      }
      // não zera 'initialized'; app já está inicializada, só sem sessão
    },
  },
});
