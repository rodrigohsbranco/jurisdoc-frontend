import type {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig } from 'axios'
import axios, {
  AxiosHeaders,
} from 'axios'
import { useAuthStore } from '@/stores/auth'

const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
})

// injeta Authorization se houver token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const auth = useAuthStore()
  if (auth?.accessToken) {
    (config.headers ||= new AxiosHeaders()).set(
      'Authorization',
      `Bearer ${auth.accessToken}`,
    )
  }
  return config
})

// tenta 1x refresh e refaz a request
api.interceptors.response.use(
  resp => resp,
  async (error: AxiosError) => {
    const auth = useAuthStore()
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined

    if (!error.response || !original) {
      throw error
    }

    const is401 = error.response.status === 401

    if (is401 && auth.refreshToken && !original._retry) {
      original._retry = true
      try {
        await auth.refresh()
        return api.request(original)
      } catch (error_) {
        await auth.logout()
        throw error_ // <- em vez de Promise.reject(e)
      }
    }

    throw error // <- em vez de Promise.reject(error)
  },
)

export default api
