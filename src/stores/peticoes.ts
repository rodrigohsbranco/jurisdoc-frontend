import type { AxiosError } from 'axios'
import { defineStore } from 'pinia'
import api from '@/services/api'

// ===== Tipos =====
export interface Petition {
  id: number
  cliente: number // FK id
  template: number // FK id
  context: Record<string, any> & {
    nome_banco?: string
    cnpj?: string
    endereco_banco?: string
  }
  created_at: string
  updated_at: string | null
  cliente_nome?: string | null // vem do serializer
  output?: string | null // opcional
}

export interface CreatePetitionPayload {
  cliente: number
  template: number
  context?: Record<string, any> & {
    nome_banco?: string
    cnpj?: string
    endereco_banco?: string
  }
}

export interface UpdatePetitionPayload {
  cliente?: number
  template?: number
  context?: Record<string, any> & {
    nome_banco?: string
    cnpj?: string
    endereco_banco?: string
  }
}

export interface ListParams {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
  cliente?: number
  template?: number
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface RenderOptions {
  filename?: string
  context_override?: Record<string, any> // sobrescreve variáveis do template
  strict?: boolean // default true no backend
}

export interface RenderResult {
  blob: Blob
  filename: string
}

export interface RenderError {
  detail: string
  missing?: string[]
  required?: string[]
}

// ===== Helpers =====
function normalize (p: Petition): Petition {
  return {
    ...p,
    cliente: Number(p.cliente),
    template: Number(p.template),
  }
}

function parseContentDispositionFilename (value?: string | null): string | null {
  if (!value) {
    return null
  }
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(value)
  const raw = decodeURIComponent(m?.[1] ?? m?.[2] ?? '')
  return raw || null
}

function buildQuery (params: Record<string, unknown>): Record<string, unknown> {
  const q: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') {
      continue
    }
    q[k] = v
  }
  return q
}

// ===== Store =====
export const usePeticoesStore = defineStore('peticoes', {
  state: () => ({
    items: [] as Petition[],
    count: 0,
    next: null as string | null,
    previous: null as string | null,
    loading: false,
    loadingMutation: false,
    error: null as string | null,
    byIdCache: new Map<number, Petition>(),
  }),

  getters: {
    byId: state => (id: number) => state.byIdCache.get(id) || state.items.find(i => i.id === id) || null,
    byCliente: state => (clienteId: number) => state.items.filter(i => i.cliente === clienteId),
  },

  actions: {
    // LISTAR
    async fetch (params: ListParams = {}): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const res = await api.get<Paginated<Petition>>('/api/petitions/', {
          params: buildQuery(params as Record<string, unknown>),

        })
        this.items = res.data.results.map(p => normalize(p))
        this.count = res.data.count
        this.next = res.data.next
        this.previous = res.data.previous
        for (const it of this.items) {
          this.byIdCache.set(it.id, it)
        }
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = e.response?.data?.detail || e.message || 'Falha ao listar petições'
        throw error
      } finally {
        this.loading = false
      }
    },

    // DETALHE
    async getDetail (id: number): Promise<Petition> {
      this.loading = true
      this.error = null
      try {
        const res = await api.get<Petition>(`/api/petitions/${id}/`)
        const data = normalize(res.data)
        this.byIdCache.set(id, data)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx !== -1) {
          this.items.splice(idx, 1, data)
        }
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = e.response?.data?.detail || e.message || 'Falha ao carregar petição'
        throw error
      } finally {
        this.loading = false
      }
    },

    // CRIAR
    async create (payload: CreatePetitionPayload): Promise<Petition> {
      this.loadingMutation = true
      this.error = null
      try {
        const res = await api.post<Petition>('/api/petitions/', payload)
        const data = normalize(res.data)
        this.items = [data, ...this.items]
        this.count += 1
        this.byIdCache.set(data.id, data)
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = e.response?.data?.detail || e.message || 'Falha ao criar petição'
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // ATUALIZAR
    async update (id: number, payload: UpdatePetitionPayload): Promise<Petition> {
      this.loadingMutation = true
      this.error = null
      try {
        const res = await api.patch<Petition>(`/api/petitions/${id}/`, payload)
        const data = normalize(res.data)
        const idx = this.items.findIndex(i => i.id === id)
        if (idx !== -1) {
          this.items.splice(idx, 1, data)
        }
        this.byIdCache.set(id, data)
        return data
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = e.response?.data?.detail || e.message || 'Falha ao atualizar petição'
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // REMOVER
    async remove (id: number): Promise<void> {
      this.loadingMutation = true
      this.error = null
      try {
        await api.delete(`/api/petitions/${id}/`)
        this.items = this.items.filter(i => i.id !== id)
        this.count = Math.max(0, this.count - 1)
        this.byIdCache.delete(id)
      } catch (error) {
        const e = error as AxiosError<any>
        this.error = e.response?.data?.detail || e.message || 'Falha ao remover petição'
        throw error
      } finally {
        this.loadingMutation = false
      }
    },

    // RENDER (gera .docx)
    async render (id: number, opts: RenderOptions = {}): Promise<RenderResult> {
      this.error = null
      try {
        const res = await api.post(
          `/api/petitions/${id}/render/`,
          {
            filename: opts.filename,
            context_override: opts.context_override ?? {},
            strict: opts.strict,
          },
          { responseType: 'blob' },
        )

        const cd = res.headers['content-disposition'] as string | undefined
        const fname = parseContentDispositionFilename(cd) || `${opts.filename || 'peticao'}.docx`
        return { blob: res.data as Blob, filename: fname }
      } catch (error) {
        const e = error as AxiosError<any>
        if (e.response && e.response.data instanceof Blob) {
          const txt = await e.response.data.text()
          try {
            const parsed: RenderError = JSON.parse(txt)
            this.error = parsed.detail
            if (parsed.missing?.length) {
              console.warn('[peticoes] Campos ausentes no template:', parsed.missing)
            }
          } catch {
            this.error = txt
          }
        } else {
          this.error = (e.response as any)?.data?.detail || e.message || 'Falha ao renderizar petição'
        }
        throw error
      }
    },

    // DOWNLOAD (.docx)
    downloadRendered (result: RenderResult): void {
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.append(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  },
})
