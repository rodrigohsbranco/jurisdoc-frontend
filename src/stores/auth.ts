import type { Router } from 'vue-router'
import axios from 'axios'
import { defineStore } from 'pinia'
import api from '@/services/api' // continua usando para as chamadas normais autenticadas

type Tokens = { access: string, refresh: string }

// Base URL (fallback se .env não estiver setado)
const BASE_URL
  = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

// axios "limpo", sem interceptors -> evita loop no refresh
const authClient = axios.create({
  baseURL: BASE_URL,
})

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: '' as string,
    refreshToken: '' as string,
    username: '' as string,
  }),
  persist: true, // pinia-plugin-persistedstate
  getters: {
    isAuthenticated: s => !!s.accessToken,
  },
  actions: {
    async login (username: string, password: string) {
      const { data } = await authClient.post<Tokens>('/api/auth/login/', { username, password })
      this.accessToken = data.access
      this.refreshToken = data.refresh
      this.username = username
    },

    async refresh () {
      if (!this.refreshToken) {
        throw new Error('Sem refresh token')
      }
      const { data } = await authClient.post<{ access: string }>('/api/auth/refresh/', {
        refresh: this.refreshToken,
      })
      this.accessToken = data.access
    },

    async logout (router?: Router) {
      this.accessToken = ''
      this.refreshToken = ''
      this.username = ''
      if (router) {
        router.replace({ name: 'login' })
      }
    },
  },
})
