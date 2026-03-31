import type {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import axios, { AxiosHeaders } from "axios";
import { useAuthStore } from "@/stores/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export function isPaginatedResponse<T>(data: any): data is PaginatedResponse<T> {
  return (
    !!data
    && typeof data === "object"
    && Array.isArray(data.results)
    && typeof data.count === "number"
    && (typeof data.next === "string" || data.next === null)
    && (typeof data.previous === "string" || data.previous === null)
  );
}

export function listFromResponse<T>(data: T[] | PaginatedResponse<T> | unknown): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (isPaginatedResponse<T>(data)) {
    return data.results;
  }
  return [];
}

export async function fetchAllPages<T>(
  url: string,
  config?: AxiosRequestConfig,
  maxPages = 100,
): Promise<T[]> {
  const first = await api.get<T[] | PaginatedResponse<T>>(url, config);
  if (!isPaginatedResponse<T>(first.data)) {
    return listFromResponse<T>(first.data);
  }

  const items: T[] = [...first.data.results];
  let next = first.data.next;
  let pageCount = 1;

  while (next && pageCount < maxPages) {
    const nextResp = await api.get<T[] | PaginatedResponse<T>>(next);
    if (!isPaginatedResponse<T>(nextResp.data)) {
      items.push(...listFromResponse<T>(nextResp.data));
      break;
    }

    items.push(...nextResp.data.results);
    next = nextResp.data.next;
    pageCount += 1;
  }

  return items;
}

// injeta Authorization e tenta refresh se necessário
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const auth = useAuthStore();

  try {
    await auth.refreshIfNeeded();
  } catch {
    // segue; se der 401, o response interceptor tenta 1x
  }

  if (auth?.accessToken) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : AxiosHeaders.from((config.headers || {}) as any);

    headers.set("Authorization", `Bearer ${auth.accessToken}`);
    config.headers = headers;
  }

  return config;
});

// tenta 1x refresh e refaz a request
api.interceptors.response.use(
  (resp) => resp,
  async (error: AxiosError) => {
    const auth = useAuthStore();
    const original = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!error.response || !original) {
      throw error;
    }

    if (
      error.response.status === 401
      && auth.refreshToken
      && !original._retry
    ) {
      original._retry = true;
      try {
        await auth.refresh();

        const headers =
          original.headers instanceof AxiosHeaders
            ? (original.headers as AxiosHeaders)
            : AxiosHeaders.from((original.headers || {}) as any);

        headers.set("Authorization", `Bearer ${auth.accessToken}`);
        original.headers = headers;

        return api.request(original);
      } catch (error_) {
        await auth.logout();
        throw error_;
      }
    }

    throw error;
  }
);

export default api;
